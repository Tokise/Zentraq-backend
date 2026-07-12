import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { rfid_uid } = await req.json();

  if (!rfid_uid) {
    return new Response(
      JSON.stringify({ error: "rfid_uid is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data: profile, error } = await supabase
    .from("clinic_profiles")
    .select("id, first_name, last_name, email, department, student_number, employee_number, active_status")
    .eq("rfid_uid", rfid_uid)
    .eq("active_status", true)
    .single();

  if (error || !profile) {
    return new Response(
      JSON.stringify({ needs_registration: true, error: "Patient not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      id: profile.id,
      name: `${profile.first_name} ${profile.last_name}`,
      email: profile.email,
      department: profile.department,
      student_number: profile.student_number,
      employee_number: profile.employee_number,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
