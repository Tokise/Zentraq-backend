import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const DATA_URL_PATTERN =
  /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_BUCKET = "clinic-profile-photos";
const TABLES = [
  { name: "students", role: "student" },
  { name: "faculty", role: "faculty" },
  { name: "staff", role: "staff" },
];

// Converts one legacy data URL into validated image bytes and an extension.
function decodePhoto(value) {
  const match = DATA_URL_PATTERN.exec(value.trim());
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;
  return {
    bytes,
    contentType: `image/${match[1]}`,
    extension: match[1] === "jpeg" ? "jpg" : match[1],
  };
}

// Migrates legacy inline profile photos to private object paths without logging PHI.
async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceRole) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE are required.");
  }

  const supabase = createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const dryRun = process.argv.includes("--dry-run");
  let candidates = 0;
  let migrated = 0;
  let skipped = 0;

  for (const table of TABLES) {
    const { data, error } = await supabase
      .from(table.name)
      .select("id,profile_photo_url")
      .like("profile_photo_url", "data:%");
    if (error) throw new Error(`Unable to read ${table.name}: ${error.code}`);

    for (const row of data ?? []) {
      const photo = decodePhoto(row.profile_photo_url ?? "");
      if (!photo) {
        skipped += 1;
        continue;
      }

      candidates += 1;
      if (dryRun) continue;

      const path =
        `${table.role}/${row.id}/${randomUUID()}.${photo.extension}`;
      const upload = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, photo.bytes, {
          contentType: photo.contentType,
          upsert: false,
        });
      if (upload.error) {
        throw new Error(`Unable to upload ${table.name} photo: ${upload.error.message}`);
      }

      const update = await supabase
        .from(table.name)
        .update({ profile_photo_url: path })
        .eq("id", row.id)
        .eq("profile_photo_url", row.profile_photo_url)
        .select("id")
        .maybeSingle();
      if (update.error || !update.data) {
        await supabase.storage.from(PHOTO_BUCKET).remove([path]);
        throw new Error(`Unable to update ${table.name} photo path.`);
      }
      migrated += 1;
    }
  }

  console.log(JSON.stringify({ candidates, dryRun, migrated, skipped }));
}

await main();


