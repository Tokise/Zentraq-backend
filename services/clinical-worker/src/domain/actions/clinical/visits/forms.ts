import { z } from "zod";
import { createAdminClient, createClient } from "../../../../runtime/context.js";

const uuid = z.string().uuid();

// Uses JWT-scoped RPCs to preserve form ownership and publication rules.
async function rpc(name: string, input: Record<string, unknown>) {
  const { data, error } = await createClient().rpc(name, input);
  if (error) throw new Error(error.message);
  return data;
}

// Returns settings and performs explicit clinic template publication.
export function clinicFormsConfigAction(input: unknown = {}) {
  const parsed = z.object({ enabled: z.boolean().optional(), publish_id: uuid.optional() }).strict().parse(input);
  return rpc("clinic_forms_config", { p_input: parsed });
}

// Generates QR images locally so identifiers never reach a third-party renderer.
export async function issueClinicFormsAction(input: unknown) {
  const parsed = z.object({ template_id: uuid, consultation_id: uuid.optional(),
    paper_size: z.enum(["A4", "Letter"]), count: z.number().int().min(1).max(25) }).strict().parse(input);
  // @ts-types="@types/qrcode"
  const { default: QRCode } = await import("qrcode");
  const forms = await rpc("issue_clinic_forms", { p_input: parsed });
  return Promise.all(forms.map(async (form: { id: string }) => ({
    ...form, qr: await QRCode.toDataURL(`ZENTRAQ-FORM:${form.id}`, { errorCorrectionLevel: "M", margin: 2 }),
  })));
}

// Resolves a form for staff and grants brief access to its private scan images.
export async function getClinicFormAction(input: unknown, consultationInput: unknown = null) {
  const id = uuid.parse(input);
  const result = await rpc("get_clinic_form", { p_id: id });
  const consultationId = uuid.nullable().parse(consultationInput);
  if (consultationId) {
    result.consultation_version = await rpc("preview_clinic_form_link", {
      p_form_id: id, p_consultation_id: consultationId,
    });
  }
  result.scans = await Promise.all(result.scans.map(async (scan: { storage_path: string }) => {
    const { data, error } = await createAdminClient().storage.from("consultation-scans").createSignedUrl(scan.storage_path, 120);
    if (error) throw new Error("SCAN_UNAVAILABLE");
    return { ...scan, url: data.signedUrl };
  }));
  if (result.form.consultation_id) {
    const { data } = await createAdminClient().from("consultations")
      .select("updated_at").eq("id", result.form.consultation_id).single();
    result.consultation_version = data?.updated_at;
  }
  return result;
}

// Checks binary content and page limits before persisting a private scan.
export async function uploadClinicScanAction(formData: FormData) {
  const formId = uuid.parse(formData.get("form_id"));
  await rpc("get_clinic_form", { p_id: formId });
  const config = await rpc("clinic_forms_config", { p_input: {} });
  if (!config.enabled) throw new Error("FORMS_DISABLED");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) throw new Error("INVALID_SCAN_SIZE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  const png = bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const mime = pdf ? "application/pdf" : png ? "image/png" : jpeg ? "image/jpeg" : null;
  if (!mime || mime !== file.type) throw new Error("INVALID_SCAN_TYPE");
  if (pdf) {
    const { PDFDocument } = await import("pdf-lib");
    const document = await PDFDocument.load(bytes);
    if (document.getPageCount() < 1 || document.getPageCount() > 5) throw new Error("SCAN_PAGE_LIMIT");
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hash = Array.from(digest).map((n) => n.toString(16).padStart(2, "0")).join("");
  const path = `${formId}/${hash}.${pdf ? "pdf" : png ? "png" : "jpg"}`;
  const { error } = await createAdminClient().storage.from("consultation-scans").upload(path, bytes, { contentType: mime, upsert: false });
  if (error && !["409", "Duplicate"].includes(String(error.statusCode))) {
    // A duplicate must be confirmed by the registration RPC's content constraint.
    if (!error.message.toLowerCase().includes("already exists")) throw new Error("SCAN_UPLOAD_FAILED");
  }
  return rpc("register_clinic_scan", { p_input: { form_id: formId, storage_path: path, content_hash: hash, mime_type: mime } });
}

// Stores confirmed source fields without silently replacing existing clinical entries.
export function reviewClinicScanAction(input: unknown) {
  const parsed = z.object({ scan_id: uuid, consultation_id: uuid, expected_version: z.string().datetime({ offset: true }),
    identity_confirmed: z.literal(true), fields_reviewed: z.literal(true),
    values: z.record(z.string().max(60), z.string().max(5000)) }).strict().parse(input);
  return rpc("review_clinic_scan", { p_input: parsed });
}
