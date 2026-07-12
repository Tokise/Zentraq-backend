import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type IdentityRecord = {
  rfid_uid?: string;
  student_number?: string;
  employee_number?: string;
  first_name: string;
  last_name: string;
  email?: string;
  department?: string;
  course?: string;
  year_level?: string;
  position?: string;
  active_status?: boolean;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const enrollmentApiUrl = Deno.env.get("STUDENT_API_BASE_URL");
  const enrollmentApiKey = Deno.env.get("STUDENT_API_KEY");

  if (!enrollmentApiUrl || !enrollmentApiKey) {
    return new Response(
      JSON.stringify({ error: "Enrollment API not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const response = await fetch(`${enrollmentApiUrl}/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${enrollmentApiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    await supabase.from("identity_sync_logs").insert({
      sync_type: "manual",
      records_synced: 0,
      status: "failed",
      error_message: `Enrollment API returned ${response.status}`,
    });

    return new Response(
      JSON.stringify({ error: "Enrollment API unavailable" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const records: IdentityRecord[] = await response.json();
  let synced = 0;

  for (const record of records) {
    const upsertData = {
      rfid_uid: record.rfid_uid ?? null,
      student_number: record.student_number ?? null,
      employee_number: record.employee_number ?? null,
      first_name: record.first_name,
      last_name: record.last_name,
      email: record.email ?? null,
      department: record.department ?? null,
      course: record.course ?? null,
      year_level: record.year_level ?? null,
      position: record.position ?? null,
      active_status: record.active_status ?? true,
      synced_at: new Date().toISOString(),
    };

    const matchKey = record.rfid_uid
      ? { rfid_uid: record.rfid_uid }
      : record.student_number
        ? { student_number: record.student_number }
        : record.employee_number
          ? { employee_number: record.employee_number }
          : null;

    if (!matchKey) continue;

    const { error } = await supabase
      .from("clinic_profiles")
      .upsert(upsertData, { onConflict: Object.keys(matchKey)[0] });

    if (!error) synced++;
  }

  await supabase.from("identity_sync_logs").insert({
    sync_type: "manual",
    records_synced: synced,
    status: "completed",
  });

  return new Response(
    JSON.stringify({ synced, total: records.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
