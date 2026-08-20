import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

export const PROFILE_PHOTO_BUCKET = "clinic-profile-photos"

const PHOTO_DATA_URL =
  /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/
const MAX_PROFILE_PHOTO_BYTES = 150 * 1024

interface UploadProfilePhotoInput {
  dataUrl: string
  profileId: string
  role: "student" | "faculty" | "staff"
}

// Uploads one validated raster image to a non-public profile path.
export async function uploadProfilePhoto(
  admin: SupabaseClient,
  input: UploadProfilePhotoInput,
): Promise<{ error: string | null; path: string | null }> {
  const match = PHOTO_DATA_URL.exec(input.dataUrl.trim())
  if (!match) {
    return { error: "Profile photos must be JPEG, PNG, or WebP images.", path: null }
  }

  const bytes = Buffer.from(match[2], "base64")
  if (bytes.byteLength > MAX_PROFILE_PHOTO_BYTES) {
    return { error: "Profile photo must be 150 KB or smaller.", path: null }
  }

  const extension = match[1] === "jpeg" ? "jpg" : match[1]
  const path = `${input.role}/${input.profileId}/${randomUUID()}.${extension}`
  const upload = await admin.storage
    .from(PROFILE_PHOTO_BUCKET)
    .upload(path, bytes, {
      contentType: `image/${match[1]}`,
      upsert: false,
    })
  if (upload.error) {
    return { error: "Unable to store the profile photo.", path: null }
  }

  return { error: null, path }
}

// Converts a private object path into a five-minute signed preview URL.
export async function resolveProfilePhotoUrl(
  admin: SupabaseClient,
  value: string | null,
): Promise<string | null> {
  if (!value || !isPrivateProfilePhotoPath(value)) return value

  const signed = await admin.storage
    .from(PROFILE_PHOTO_BUCKET)
    .createSignedUrl(value, 5 * 60)
  return signed.error ? null : signed.data.signedUrl
}

// Deletes only paths owned by the private profile-photo bucket.
export async function removeProfilePhoto(
  admin: SupabaseClient,
  value: string | null,
): Promise<void> {
  if (!value || !isPrivateProfilePhotoPath(value)) return
  await admin.storage.from(PROFILE_PHOTO_BUCKET).remove([value])
}

// Identifies the bounded object-key shape used for new profile photos.
function isPrivateProfilePhotoPath(value: string): boolean {
  return /^(student|faculty|staff)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(
    value,
  )
}
