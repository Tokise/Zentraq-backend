"""Maps OCR lines into editable source fields, never clinical decisions."""

import re


# Normalizes printed labels without treating extracted content as commands.
def normalize_label(text):
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


# Keeps uncertain and missing fields explicit for mandatory human review.
def map_fields(lines, fields):
    result = {key: {"text": "", "confidence": 0.0} for key in fields}
    active = None
    for text, confidence in lines:
        label, separator, value = text.partition(":")
        key = normalize_label(label)
        if key in result:
            active = key
            if separator and value.strip():
                result[key] = {"text": value.strip()[:5000], "confidence": float(confidence)}
        elif active and not any(term in text.lower() for term in ["form id", "page 1", "staff must review"]):
            current = result[active]
            current["text"] = (current["text"] + " " + text).strip()[:5000]
            current["confidence"] = min(current["confidence"] or 1.0, float(confidence))
    # Handwritten signatures are images, not verified identities.
    for key in fields:
        if "signature" in key:
            result[key] = {"text": "", "confidence": 0.0}
    return {"fields": result, "warnings": ["Verify identity and every field against the original scan."]}


# Rejects QR codes belonging to other forms before any proposed import is produced.
def verify_form_codes(codes, form_id):
    expected = "ZENTRAQ-FORM:" + form_id
    if any(code.startswith("ZENTRAQ-FORM:") and code != expected for code in codes):
        raise ValueError("FORM_MISMATCH")
    return expected in codes
