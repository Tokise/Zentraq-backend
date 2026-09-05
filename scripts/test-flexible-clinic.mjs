import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();

// Builds an isolated structural fixture; this is deliberately not a production baseline replay.
async function setup() {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private; create schema storage;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text);
  `);
  const snapshot = process.env.CLINIC_TEST_CURRENT_SNAPSHOT === "1"
    ? await readFile("supabase/baselines/clinic.sql", "utf8")
    : execFileSync("git", ["show", "HEAD:supabase/baselines/clinic.sql"], { encoding: "utf8" });
  const tables = snapshot.match(/CREATE TABLE public\.[\s\S]*?\n\);/g);
  for (let sql of tables) {
    sql = sql.replace(/\bARRAY NOT NULL/g, "text[] NOT NULL").replace(/^\s*CONSTRAINT [^\n]*FOREIGN KEY[^\n]*\n/gm, "").replace(/,\s*\);$/, "\n);");
    await db.exec(sql);
  }
  await db.exec(`
    create table if not exists public.portal_login_identities(user_id uuid,login_id text,is_active boolean);
    create unique index triage_consultation_test_idx on public.triage_assessments(consultation_id);
    create function public.get_clinician_workload_stats(uuid,text) returns jsonb language sql as $$select '{}'::jsonb$$;
    create function private.is_review_doctor_available(uuid,timestamptz) returns boolean language sql as $$select true$$;
    create function private.enqueue_review_notification(uuid,uuid,uuid,text) returns void language sql as $$select$$;
  `);
  const repairs = await readFile("supabase/migrations/20260904111911_clinical_edge_monthly_repairs.sql", "utf8");
  const start = repairs.indexOf("create table if not exists private.clinical_notice_outbox");
  const end = repairs.indexOf("-- Enqueues upload notices", start);
  await db.exec(repairs.slice(start, end).replaceAll("references auth.users", "references public.users"));
  const migration = await readFile("supabase/migrations/20260905104629_flexible_clinic_workflows.sql", "utf8");
  // Reproduces the deployed institutional-only constraint behind the reported 42710 error.
  await db.exec(`
    alter table public.clinic_visits drop constraint if exists clinic_visits_patient_reference_check;
    alter table public.clinic_visits add constraint clinic_visits_patient_reference_check
      check (patient_type in ('student', 'faculty', 'staff')) not valid;
  `);
  await db.exec(migration);
  await db.exec("update clinic_form_settings set enabled=true");
  await db.exec(migration);
  assert.equal((await db.query("select count(*)::int as n from clinic_form_templates")).rows[0].n,3);
  assert.equal((await db.query("select enabled from clinic_form_settings")).rows[0].enabled,true);
  await db.exec("update clinic_form_settings set enabled=false");
}

// Runs a database operation with the same actor identity used by JWT-scoped RPCs.
async function actor(id) {
  await db.query("select set_config('test.actor',$1,false)", [id]);
}

// Asserts database rejection, so browser validation cannot mask access-control defects.
async function rejects(sql, params = []) {
  await assert.rejects(() => db.query(sql, params));
}

try {
  await setup();
  const nurse = "00000000-0000-4000-8000-000000000001";
  const doctor = "00000000-0000-4000-8000-000000000002";
  const admin = "00000000-0000-4000-8000-000000000003";
  const other = "00000000-0000-4000-8000-000000000004";
  for (const [id, role] of [[nurse,"nurse"],[doctor,"doctor"],[admin,"admin"],[other,"nurse"]]) {
    await db.query("insert into users(id,email) values($1,$2)", [id, `${id}@example.test`]);
    await db.query("insert into roles(name) values($1) on conflict do nothing", [role]);
    await db.query("insert into user_roles(user_id,role_id) select $1,id from roles where name=$2", [id,role]);
    await db.query("insert into clinic_accounts(id,user_id,role,display_name) values($1,$1,$2,$2)", [id,role]);
  }
  await actor(nurse);
  const input = { request_id: "10000000-0000-4000-8000-000000000001", patient_type: "visitor",
    complaint: "Test case", visitor: { first_name: "Sample", last_name: "Visitor", category: "parent" } };
  const first = (await db.query("select create_manual_visit($1) as id", [input])).rows[0].id;
  const retry = (await db.query("select create_manual_visit($1) as id", [input])).rows[0].id;
  assert.equal(first, retry);
  assert.equal((await db.query("select count(*)::int as n from visitors")).rows[0].n, 1);
  await actor(other);
  await rejects("select get_workflow_support($1)", [first]);
  await actor(nurse);
  await rejects("select manage_clinical_protocol($1)", [{ operation: "enable", id: nurse, enabled: true }]);
  await rejects("select issue_clinic_forms($1)", [{ template_id: nurse, paper_size: "A4", count: 1 }]);
  assert.equal((await db.query("select has_function_privilege('anon','public.create_manual_visit(jsonb)','execute') as allowed")).rows[0].allowed, false);
  assert.equal((await db.query("select has_function_privilege('authenticated','public.resolve_portal_login_v1(text)','execute') as allowed")).rows[0].allowed, false);
  await actor(admin);
  await rejects("select create_manual_visit($1)", [{ ...input, request_id: "10000000-0000-4000-8000-000000000002" }]);
  await actor(doctor);
  const medicine = "20000000-0000-4000-8000-000000000001";
  await db.query("insert into medicines(id,generic_name,unit,is_active,approval_status) values($1,'Test medicine','unit',true,'approved')", [medicine]);
  const rules = { case_description: "Test case only", eligibility: ["Test criterion"], exclusions: ["Test exclusion"],
    escalation: "Request doctor review", required_vitals: ["temperature"], min_age: 18, max_age: 100,
    medicines: [{ medicine_id: medicine, dosage: "test dose", frequency: "test frequency", max_quantity: 2, max_duration_days: 1 }] };
  await db.query("select manage_clinical_protocol($1)", [{ operation: "create", title: "Test protocol", version: 1,
    expires_at: "2099-01-01T00:00:00Z", rules }]);
  const protocol = (await db.query("select id from clinical_protocol_versions")).rows[0].id;
  await db.query("select manage_clinical_protocol($1)", [{ operation: "approve", id: protocol }]);
  await actor(admin);
  await db.query("select manage_clinical_protocol($1)", [{ operation: "enable", id: protocol, enabled: true }]);
  await actor(nurse);
  const finalize = "select finalize_consultation_workflow_v2($1,'Test case',null,'required',null,$2,'Test outcome',null,null,$3,null,$4,$5,'Test nursing assessment')";
  const eligibility = { criteria: [true], no_exclusions: true, allergies_checked: true, age_years: 30 };
  const order = { medicine_id: medicine, dosage: "test dose", frequency: "test frequency", quantity: 2, duration_days: 1 };
  await rejects(finalize, [first, {}, [order], protocol, eligibility]);
  await rejects(finalize, [first, { temperature: 37 }, [{ ...order, quantity: 3 }], protocol, eligibility]);
  await rejects(finalize, [first, { temperature: 37 }, [order], protocol, { ...eligibility, no_exclusions: false }]);
  await db.query(finalize, [first, { temperature: 37 }, [order], protocol, eligibility]);
  const completed = (await db.query("select status,doctor_id,doctor_reviewed_at,nursing_assessment from consultations where id=$1", [first])).rows[0];
  assert.equal(completed.status, "completed");
  assert.equal(completed.doctor_id, null);
  assert.equal(completed.doctor_reviewed_at, null);
  assert.equal((await db.query("select prescribed_by,protocol_approved_by from prescriptions")).rows[0].prescribed_by, nurse);
  assert.equal((await db.query("select protocol_approved_by from prescriptions")).rows[0].protocol_approved_by, doctor);
  await rejects(finalize, [first, { temperature: 37 }, [order], protocol, eligibility]);
  await actor(nurse);
  const visitorId = (await db.query("select id from visitors limit 1")).rows[0].id;
  const follow = (await db.query("select create_manual_visit($1) as id", [{
    request_id: "10000000-0000-4000-8000-000000000003", patient_type: "visitor", patient_id: visitorId, complaint: "Follow-up test",
  }])).rows[0].id;
  await rejects(finalize, [follow, { temperature: 999 }, [order], protocol, eligibility]);
  await db.query("select nurse_duty_status(true)");
  await actor(doctor);
  const doctorVisit = (await db.query("select create_manual_visit($1) as id", [{
    request_id: "10000000-0000-4000-8000-000000000004", patient_type: "visitor", patient_id: visitorId, complaint: "Doctor test",
  }])).rows[0].id;
  assert.equal((await db.query("select nurse_id from consultations where id=$1", [doctorVisit])).rows[0].nurse_id,nurse);
  assert.equal((await db.query("select count(*)::int as n from private.clinical_notice_outbox")).rows[0].n,1);
  await actor(other);
  await rejects("select claim_nurse_assistance($1)",[doctorVisit]);
  await actor(nurse);
  const clearance = (await db.query("select request_consultation_clearance($1,'School visit test') as id",[follow])).rows[0].id;
  assert.equal((await db.query("select visitor_id,status from health_clearances where id=$1",[clearance])).rows[0].visitor_id,visitorId);
  const template = (await db.query("select id from clinic_form_templates order by title limit 1")).rows[0].id;
  await actor(admin);
  await db.query("select clinic_forms_config($1)",[{ enabled:true, publish_id:template }]);
  await actor(nurse);
  const form = (await db.query("select issue_clinic_forms($1) as forms",[{
    template_id:template,consultation_id:follow,paper_size:"A4",count:1,
  }])).rows[0].forms[0];
  const hash="a".repeat(64), storagePath=form.id+"/"+hash+".jpg";
  await db.query("insert into storage.objects values('consultation-scans',$1)",[storagePath]);
  const scanInput={form_id:form.id,storage_path:storagePath,content_hash:hash,mime_type:"image/jpeg"};
  const scan=(await db.query("select register_clinic_scan($1) as id",[scanInput])).rows[0].id;
  assert.equal((await db.query("select register_clinic_scan($1) as id",[scanInput])).rows[0].id,scan);
  const job=(await db.query("select claim_clinic_ocr_job() as job")).rows[0].job;
  await rejects("select finish_clinic_ocr_job($1,$2,'{}',null)",[scan,doctor]);
  await db.query("select finish_clinic_ocr_job($1,$2,$3,null)",[scan,job.lease_id,{fields:{complaint:{text:"Reviewed source",confidence:0.6}}}]);
  const version=(await db.query("select updated_at from consultations where id=$1",[follow])).rows[0].updated_at;
  const review={scan_id:scan,consultation_id:follow,expected_version:version,
    identity_confirmed:true,fields_reviewed:true,values:{complaint:"Reviewed source"}};
  await rejects("select review_clinic_scan($1)",[{...review,identity_confirmed:false}]);
  await rejects("select review_clinic_scan($1)",[{...review,expected_version:"2000-01-01T00:00:00Z"}]);
  await actor(other);
  await rejects("select get_clinic_form($1)",[form.id]);
  await rejects("select review_clinic_scan($1)",[review]);
  await actor(nurse);
  await db.query("select review_clinic_scan($1)",[review]);
  assert.equal((await db.query("select patient_complaint from consultations where id=$1",[follow])).rows[0].patient_complaint,"Follow-up test");
  await actor(admin);
  await db.query("select clinic_forms_config($1)",[{enabled:false}]);
  await actor(nurse);
  await db.query("select get_clinic_form($1)",[form.id]);
  await rejects("select issue_clinic_forms($1)",[{template_id:template,paper_size:"Letter",count:1}]);
  console.log("PASS: rerunnable migration; login grants; visitor retry/assignment; protocol limits and completion; assistance/outbox; visitor clearance; scan deduplication, leases, review, stale data, isolation and feature toggle");
} catch (error) {
  console.error(error.message, error.where ?? "", error.detail ?? "", error.position ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
