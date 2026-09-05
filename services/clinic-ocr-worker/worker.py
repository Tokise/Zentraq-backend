"""Private pull worker. Preload models; never send scans to external OCR services."""

import io
import json
import os
import time
from urllib.parse import quote
from urllib.request import Request, urlopen

from extraction import map_fields, verify_form_codes

MAX_BYTES = 10 * 1024 * 1024


# Sends fixed RPC requests without putting secrets or document content into logs.
def request(path, payload=None, binary=False):
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": key, "Authorization": "Bearer " + key}
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode()
    with urlopen(Request(base + path, data=body, headers=headers), timeout=30) as response:
        result = response.read(MAX_BYTES + 1)
        if len(result) > MAX_BYTES:
            raise ValueError("RESPONSE_TOO_LARGE")
        return result if binary else json.loads(result or b"null")


# Renders bounded pages in memory; decrypted scan files are never persisted locally.
def render_pages(data, mime):
    from PIL import Image
    import pypdfium2 as pdfium

    Image.MAX_IMAGE_PIXELS = 20_000_000
    if mime == "application/pdf":
        document = pdfium.PdfDocument(data)
        try:
            if not 1 <= len(document) <= 5:
                raise ValueError("PAGE_LIMIT")
            for index in range(len(document)):
                page = document[index]
                width, height = page.get_size()
                if width * height * 4 > 20_000_000:
                    raise ValueError("IMAGE_TOO_LARGE")
                bitmap = page.render(scale=2)
                try:
                    yield bitmap.to_pil().convert("RGB")
                finally:
                    bitmap.close()
                    page.close()
        finally:
            document.close()
    else:
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > 20_000_000:
                raise ValueError("IMAGE_TOO_LARGE")
            yield image.convert("RGB")


# Runs preloaded local models and checks form identifiers before returning draft text.
def extract(engine, job, data):
    import cv2
    import numpy as np

    lines = []
    codes = []
    for page in render_pages(data, job["mime_type"]):
        array = np.asarray(page)
        code, _, _ = cv2.QRCodeDetector().detectAndDecode(array)
        if code:
            codes.append(code)
        verify_form_codes(codes, job["form_id"])
        for prediction in engine.predict(array):
            texts = prediction.get("rec_texts", [])
            scores = prediction.get("rec_scores", [])
            lines.extend(zip(texts, scores))
        page.close()
    result = map_fields(lines, job["fields"])
    if not verify_form_codes(codes, job["form_id"]):
        result["warnings"].append("QR unreadable: staff must confirm the printed form identifier.")
    return result


# Pulls leased work so no inbound clinic-network port needs to be exposed.
def main():
    from paddleocr import PaddleOCR

    detection = os.environ["OCR_DETECTION_MODEL_DIR"]
    recognition = os.environ["OCR_RECOGNITION_MODEL_DIR"]
    if not os.path.isdir(detection) or not os.path.isdir(recognition):
        raise RuntimeError("PRELOADED_MODELS_REQUIRED")
    engine = PaddleOCR(
        text_detection_model_dir=detection,
        text_recognition_model_dir=recognition,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        device="cpu",
    )
    while True:
        job = None
        try:
            job = request("/rest/v1/rpc/claim_clinic_ocr_job", {})
            if not job:
                time.sleep(5)
                continue
            path = quote(job["storage_path"], safe="/")
            data = request("/storage/v1/object/authenticated/consultation-scans/" + path, binary=True)
            extracted = extract(engine, job, data)
            del data
            request("/rest/v1/rpc/finish_clinic_ocr_job", {
                "p_id": job["id"], "p_lease": job["lease_id"],
                "p_extracted": extracted, "p_failure": None,
            })
            print('{"event":"clinic_ocr","outcome":"review_ready"}', flush=True)
        except Exception:
            if job:
                try:
                    request("/rest/v1/rpc/finish_clinic_ocr_job", {
                        "p_id": job["id"], "p_lease": job["lease_id"],
                        "p_extracted": None, "p_failure": "OCR_REVIEW_REQUIRED",
                    })
                except Exception:
                    pass
            print('{"event":"clinic_ocr","outcome":"retry_or_manual_review"}', flush=True)
            time.sleep(5)


if __name__ == "__main__":
    main()
