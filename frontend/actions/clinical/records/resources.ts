"use server";

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard";
import { createAdminClient } from "@/utils/supabase/admin";

type StaffRole = "admin" | "doctor" | "nurse";

const STUDENT_DOCUMENTS_BUCKET = "student-documents";
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor();
  return actor && hasAnyRole(actor, roles) ? actor : null;
}

export interface StudentDocumentRow {
  id: string;
  student_id: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  student_name: string | null;
  student_number: string | null;
}

type StudentDocumentQueryRow = {
  id: string;
  student_id: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  students:
    | { first_name: string; last_name: string; student_number: string | null }
    | Array<{
        first_name: string;
        last_name: string;
        student_number: string | null;
      }>
    | null;
};

export async function getStudentDocumentsAction(patientId?: string): Promise<{
  error: string | null;
  documents: StudentDocumentRow[];
}> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor)
    return { error: "Access denied", documents: [] as StudentDocumentRow[] };

  const admin = createAdminClient();
  let query = admin
    .from("student_documents")
    .select(
      `
      id, student_id, document_type, file_url, file_name, mime_type, file_size, created_at,
      students(first_name, last_name, student_number)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (patientId) query = query.eq("student_id", patientId);

  const { data, error } = await query;
  if (error)
    return { error: error.message, documents: [] as StudentDocumentRow[] };

  const rows = (data ?? []) as StudentDocumentQueryRow[];
  const storedPaths = rows
    .map((row) => row.file_url)
    .filter(isStoredDocumentPath);
  const { data: signedUrls } = storedPaths.length
    ? await admin.storage
        .from(STUDENT_DOCUMENTS_BUCKET)
        .createSignedUrls(storedPaths, 15 * 60)
    : { data: [] };
  const signedUrlByPath = new Map(
    (signedUrls ?? []).map((signedUrl) => [
      signedUrl.path,
      signedUrl.signedUrl ?? "",
    ]),
  );

  const documents: StudentDocumentRow[] = rows.map((row) => {
    const student = Array.isArray(row.students)
      ? row.students[0]
      : row.students;
    let fileUrl = row.file_url;

    if (isStoredDocumentPath(row.file_url)) {
      fileUrl = signedUrlByPath.get(row.file_url) ?? "";
    }

    return {
      id: row.id,
      student_id: row.student_id,
      document_type: row.document_type,
      file_url: fileUrl,
      file_name: row.file_name,
      mime_type: row.mime_type,
      file_size: row.file_size,
      uploaded_at: row.created_at,
      student_name: student
        ? `${student.first_name} ${student.last_name}`
        : null,
      student_number: student?.student_number ?? null,
    };
  });

  return { error: null, documents };
}

export async function getEmergencyContactsAction(): Promise<{
  error: string | null;
  contacts: Array<{
    id: string;
    name: string;
    role: string;
    phone: string;
    email: string | null;
    location: string | null;
  }>;
}> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return { error: "Access denied", contacts: [] };

  const admin = createAdminClient();
  const { data: settings, error: settingsError } = await admin
    .from("settings")
    .select("key, value")
    .eq("key", "clinic_info")
    .maybeSingle();

  if (settingsError) return { error: settingsError.message, contacts: [] };

  const clinic = settings?.value ?? {};
  const contacts = [
    {
      id: "clinic",
      name: String(clinic.name || "University Health Services Clinic"),
      role: "Clinic",
      phone: String(clinic.phone || "—"),
      email: String(clinic.email || null),
      location: String(clinic.address || null),
    },
    {
      id: "emergency",
      name: "Campus Emergency",
      role: "Emergency",
      phone: "9-1-1",
      email: null,
      location: "Campus-wide",
    },
    {
      id: "security",
      name: "Campus Security",
      role: "Security",
      phone: "8-7000",
      email: null,
      location: "Main Gate",
    },
  ];

  return { error: null, contacts };
}

/** Uploads an approved medical document to private storage and records its metadata. */
export async function uploadStudentDocumentAction(
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const actor = await staff(["admin", "nurse"])
  if (!actor) return { error: "Access denied" }

  const studentId = String(formData.get("studentId") || "")
  const documentType = String(formData.get("documentType") || "")
  const file = formData.get("file")

  if (
    !studentId ||
    !documentType ||
    !(file instanceof File) ||
    file.size === 0
  ) {
    return { error: "Student, document type, and a file are required" }
  }

  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    return { error: "Upload a PDF, JPEG, or PNG file" }
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return { error: "Files must be 10 MB or smaller" }
  }

  // Compress image files before upload
  let uploadFile = file
  if (file.type.startsWith("image/")) {
    try {
      const { compressImage } = await import("@/lib/utils/file-compression")
      const compressedBlob = await compressImage(file)
      uploadFile = new File([compressedBlob], file.name, { type: "image/webp" })
    } catch (err) {
      console.error("Image compression failed, uploading original:", err)
    }
  }

  const extension = uploadFile.name.split(".").pop()?.toLowerCase()
  const safeExtension =
    extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : "bin"
  const storagePath = `${studentId}/${crypto.randomUUID()}.${safeExtension}`
  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from(STUDENT_DOCUMENTS_BUCKET)
    .upload(storagePath, await uploadFile.arrayBuffer(), {
      contentType: uploadFile.type,
      upsert: false,
    })

  if (uploadError) return { error: uploadError.message }

  const { error } = await admin.from("student_documents").insert({
    student_id: studentId,
    document_type: documentType,
    file_url: storagePath,
    file_name: uploadFile.name,
    mime_type: uploadFile.type,
    file_size: uploadFile.size,
    uploaded_by: actor.id,
  })

  if (error) {
    await admin.storage.from(STUDENT_DOCUMENTS_BUCKET).remove([storagePath])
    return { error: error.message }
  }

  return { success: true }
}

function isStoredDocumentPath(fileUrl: string) {
  return !/^https?:\/\//i.test(fileUrl);
}
