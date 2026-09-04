import { createAdminClient } from "../../../../runtime/context.ts";
import { getActionActor, hasAnyRole } from "../../../../runtime/context.ts";

const STAFF_DOCUMENTS_BUCKET = "staff-documents";
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

type StaffRole = "admin" | "doctor" | "nurse";

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor();
  return actor && hasAnyRole(actor, roles) ? actor : null;
}

export interface StaffDocumentRow {
  id: string;
  staff_id: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  staff_name: string | null;
  staff_number: string | null;
}

export async function getStaffDocumentsAction(patientId?: string): Promise<{
  error: string | null;
  documents: StaffDocumentRow[];
}> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) {
    return { error: "Access denied", documents: [] as StaffDocumentRow[] };
  }

  const admin = createAdminClient();
  let query = admin
    .from("staff_documents")
    .select(
      `
      id, staff_id, document_type, file_url, file_name, mime_type, file_size, created_at,
      staff:staff(first_name, last_name, employee_number)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (patientId) query = query.eq("staff_id", patientId);

  const { data, error } = await query;
  if (error) {
    return { error: error.message, documents: [] as StaffDocumentRow[] };
  }

  const rows = (data ?? []) as unknown as Array<
    Omit<StaffDocumentRow, "uploaded_at" | "staff_name" | "staff_number"> & {
      created_at: string;
      staff: {
        first_name: string;
        last_name: string;
        employee_number: string | null;
      } | Array<{
        first_name: string;
        last_name: string;
        employee_number: string | null;
      }> | null;
    }
  >;
  const storedPaths = rows
    .map((row) => row.file_url)
    .filter(isStoredDocumentPath);
  const { data: signedUrls } = storedPaths.length
    ? await admin.storage
      .from(STAFF_DOCUMENTS_BUCKET)
      .createSignedUrls(storedPaths, 15 * 60)
    : { data: [] };
  const signedUrlByPath = new Map(
    (signedUrls ?? []).map((signedUrl) => [
      signedUrl.path,
      signedUrl.signedUrl ?? "",
    ]),
  );

  const documents: StaffDocumentRow[] = rows.map((row) => {
    const staff = Array.isArray(row.staff) ? row.staff[0] : row.staff;
    let fileUrl = row.file_url;

    if (isStoredDocumentPath(row.file_url)) {
      fileUrl = signedUrlByPath.get(row.file_url) ?? "";
    }

    return {
      id: row.id,
      staff_id: row.staff_id,
      document_type: row.document_type,
      file_url: fileUrl,
      file_name: row.file_name,
      mime_type: row.mime_type,
      file_size: row.file_size,
      uploaded_at: row.created_at,
      staff_name: staff ? `${staff.first_name} ${staff.last_name}` : null,
      staff_number: staff?.employee_number ?? null,
    };
  });

  return { error: null, documents };
}

export async function uploadStaffDocumentAction(
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const actor = await staff(["admin", "nurse"]);
  if (!actor) return { error: "Access denied" };

  const staffId = String(formData.get("staffId") || "");
  const documentType = String(formData.get("documentType") || "");
  const file = formData.get("file");

  if (
    !staffId ||
    !documentType ||
    !(file instanceof File) ||
    file.size === 0
  ) {
    return { error: "Staff member, document type, and a file are required" };
  }

  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    return { error: "Upload a PDF, JPEG, or PNG file" };
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return { error: "Files must be 10 MB or smaller" };
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const safeExtension = extension && /^[a-z0-9]{1,8}$/.test(extension)
    ? extension
    : "bin";
  const storagePath = `${staffId}/${crypto.randomUUID()}.${safeExtension}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(STAFF_DOCUMENTS_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  const { error } = await admin.from("staff_documents").insert({
    staff_id: staffId,
    document_type: documentType,
    file_url: storagePath,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
    uploaded_by: actor.id,
  });

  if (error) {
    await admin.storage.from(STAFF_DOCUMENTS_BUCKET).remove([storagePath]);
    return { error: error.message };
  }

  return { success: true };
}

export async function deleteStaffDocumentAction(documentId: string) {
  const actor = await staff(["admin", "nurse"]);
  if (!actor) return { error: "Access denied" };

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("staff_documents")
    .select("file_url")
    .eq("id", documentId)
    .maybeSingle();

  if (!doc) return { error: "Document not found" };

  const { error: deleteError } = await admin
    .from("staff_documents")
    .delete()
    .eq("id", documentId);

  if (deleteError) return { error: deleteError.message };

  if (isStoredDocumentPath(doc.file_url)) {
    await admin.storage.from(STAFF_DOCUMENTS_BUCKET).remove([doc.file_url]);
  }

  return { success: true };
}

function isStoredDocumentPath(fileUrl: string) {
  return !/^https?:\/\//i.test(fileUrl);
}
