import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const { rfid_uid } = await req.json();

  // Call external student API securely (server-side only)
  const studentResponse = await fetch(
    `${Deno.env.get("STUDENT_API_BASE_URL")}/lookup`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("STUDENT_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rfid_uid }),
    },
  );

  const student = await studentResponse.json();

  // Return only non-sensitive data
  return new Response(
    JSON.stringify({
      id: student.id,
      name: student.name,
      email: student.email,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
});
