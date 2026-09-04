import { createAdminClient } from "../../../../runtime/context.ts";
import { getActionActor, hasAnyRole } from "../../../../runtime/context.ts";

const BUCKET = "faculty-documents";
const MAX_SIZE = 10 * 1024 * 1024;

// Returns signed faculty document URLs to authorized clinic staff.
export async function getFacultyDocumentsAction(facultyId: string) {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["admin", "doctor", "nurse"])) {
    return { error: "Access denied", documents: [] };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("faculty_documents")
    .select("id, document_type, file_url, file_name, mime_type")
    .eq("faculty_id", facultyId)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message, documents: [] };
  const paths = (data ?? []).map((document) => document.file_url);
  const { data: signed } = paths.length
    ? await admin.storage.from(BUCKET).createSignedUrls(paths, 15 * 60)
    : { data: [] };
  const urlByPath = new Map(
    (signed ?? []).map((item) => [item.path, item.signedUrl]),
  );
  return {
    error: null,
    documents: (data ?? []).map((document) => ({
      ...document,
      file_url: urlByPath.get(document.file_url) ?? "",
    })),
  };
}

// Uploads a faculty attachment after validating file type and size.
export async function uploadFacultyDocumentAction(formData: FormData) {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["admin", "nurse"])) {
    return { error: "Access denied" };
  }
  const facultyId = String(formData.get("facultyId") ?? "");
  const documentType = String(formData.get("documentType") ?? "");
  const file = formData.get("file");
  if (
    !facultyId || !documentType || !(file instanceof File) || file.size === 0
  ) {
    return { error: "Faculty member, document type, and file are required" };
  }
  if (
    !new Set(["application/pdf", "image/jpeg", "image/png"]).has(file.type) ||
    file.size > MAX_SIZE
  ) {
    return { error: "Upload a PDF, JPEG, or PNG file no larger than 10 MB" };
  }
  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${facultyId}/${crypto.randomUUID()}.${extension}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(
    path,
    await file.arrayBuffer(),
    { contentType: file.type, upsert: false },
  );
  if (uploadError) return { error: uploadError.message };
  const { error } = await admin.from("faculty_documents").insert({
    faculty_id: facultyId,
    document_type: documentType,
    file_url: path,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
    uploaded_by: actor.id,
  });
  if (error) await admin.storage.from(BUCKET).remove([path]);
  return error ? { error: error.message } : { success: true };
}
