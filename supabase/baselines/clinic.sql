-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  is_deletable boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  name text,
  resource text,
  action text,
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  assigned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id)
);
CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id),
  CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id)
);
CREATE TABLE public.students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  student_number text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  middle_name text,
  department text,
  course text,
  year_level integer,
  section text,
  phone text,
  email text,
  address text,
  birth_date date,
  gender text,
  blood_type text,
  emergency_contact_name text,
  emergency_contact_phone text,
  guardian_name text,
  guardian_phone text,
  rfid_uid text UNIQUE,
  status text DEFAULT 'active'::text,
  profile_photo_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.student_medical_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  condition_name text NOT NULL,
  diagnosed_date date,
  status text DEFAULT 'active'::text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_medical_history_pkey PRIMARY KEY (id),
  CONSTRAINT student_medical_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_medical_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.student_allergies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  allergen text NOT NULL,
  reaction text,
  severity text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_allergies_pkey PRIMARY KEY (id),
  CONSTRAINT student_allergies_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_allergies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.student_medications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  medicine_name text NOT NULL,
  dosage text,
  frequency text,
  start_date date,
  end_date date,
  prescribed_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_medications_pkey PRIMARY KEY (id),
  CONSTRAINT student_medications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_medications_prescribed_by_fkey FOREIGN KEY (prescribed_by) REFERENCES public.users(id)
);
CREATE TABLE public.student_immunizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  vaccine_name text NOT NULL,
  administered_date date,
  dose_number integer,
  lot_number text,
  administered_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_immunizations_pkey PRIMARY KEY (id),
  CONSTRAINT student_immunizations_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_immunizations_administered_by_fkey FOREIGN KEY (administered_by) REFERENCES public.users(id)
);
CREATE TABLE public.student_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  document_type text NOT NULL,
  file_url text NOT NULL,
  file_name text,
  mime_type text,
  file_size integer,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_documents_pkey PRIMARY KEY (id),
  CONSTRAINT student_documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);
CREATE TABLE public.faculty (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  employee_number text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  middle_name text,
  department text,
  position text,
  phone text,
  email text,
  address text,
  rfid_uid text UNIQUE,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  profile_photo_url text,
  CONSTRAINT faculty_pkey PRIMARY KEY (id),
  CONSTRAINT faculty_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.faculty_medical_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL,
  condition_name text NOT NULL,
  diagnosed_date date,
  status text DEFAULT 'active'::text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT faculty_medical_history_pkey PRIMARY KEY (id),
  CONSTRAINT faculty_medical_history_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id),
  CONSTRAINT faculty_medical_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.faculty_allergies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL,
  allergen text NOT NULL,
  reaction text,
  severity text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT faculty_allergies_pkey PRIMARY KEY (id),
  CONSTRAINT faculty_allergies_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id),
  CONSTRAINT faculty_allergies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.faculty_medications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL,
  medicine_name text NOT NULL,
  dosage text,
  frequency text,
  start_date date,
  end_date date,
  prescribed_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT faculty_medications_pkey PRIMARY KEY (id),
  CONSTRAINT faculty_medications_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id),
  CONSTRAINT faculty_medications_prescribed_by_fkey FOREIGN KEY (prescribed_by) REFERENCES public.users(id)
);
CREATE TABLE public.clinic_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text])),
  display_name text NOT NULL,
  license_number text,
  current_session_token text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clinic_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT clinic_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.clinic_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_type text NOT NULL,
  student_id uuid,
  faculty_id uuid,
  visit_type text NOT NULL CHECK (visit_type = ANY (ARRAY['walk-in'::text, 'appointment'::text, 'rfid'::text])),
  check_in_time timestamp with time zone NOT NULL DEFAULT now(),
  check_out_time timestamp with time zone,
  status text DEFAULT 'in-progress'::text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  staff_id uuid,
  visitor_id uuid,
  CONSTRAINT clinic_visits_pkey PRIMARY KEY (id),
  CONSTRAINT clinic_visits_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES public.visitors(id),
  CONSTRAINT clinic_visits_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT clinic_visits_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id),
  CONSTRAINT clinic_visits_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT clinic_visits_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id)
);
CREATE TABLE public.consultations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL,
  appointment_id uuid,
  doctor_id uuid,
  nurse_id uuid,
  patient_complaint text,
  consultation_notes text,
  status text DEFAULT 'in-progress'::text CHECK (status = ANY (ARRAY['queued'::text, 'claimed'::text, 'in-progress'::text, 'awaiting_doctor_review'::text, 'completed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  vitals_disposition text NOT NULL DEFAULT 'not_assessed'::text CHECK (vitals_disposition = ANY (ARRAY['not_assessed'::text, 'required'::text, 'not_required'::text, 'recorded'::text])),
  vitals_skip_reason text,
  vitals_assessed_by uuid,
  vitals_assessed_at timestamp with time zone,
  claimed_by_user_id uuid,
  claimed_by_clinic_account_id uuid,
  claimed_at timestamp with time zone,
  completed_by_user_id uuid,
  completed_by_clinic_account_id uuid,
  review_doctor_id uuid,
  review_requested_by uuid,
  review_requested_at timestamp with time zone,
  nurse_handoff_note text,
  nurse_handoff_at timestamp with time zone,
  doctor_review_note text,
  doctor_reviewed_at timestamp with time zone,
  nursing_assessment text,
  CONSTRAINT consultations_pkey PRIMARY KEY (id),
  CONSTRAINT consultations_review_doctor_id_fkey FOREIGN KEY (review_doctor_id) REFERENCES public.clinic_accounts(id),
  CONSTRAINT consultations_review_requested_by_fkey FOREIGN KEY (review_requested_by) REFERENCES public.users(id),
  CONSTRAINT consultations_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.clinic_visits(id),
  CONSTRAINT consultations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.clinic_accounts(id),
  CONSTRAINT consultations_nurse_id_fkey FOREIGN KEY (nurse_id) REFERENCES public.clinic_accounts(id),
  CONSTRAINT consultations_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id),
  CONSTRAINT consultations_vitals_assessed_by_fkey FOREIGN KEY (vitals_assessed_by) REFERENCES public.users(id),
  CONSTRAINT consultations_claimed_by_user_id_fkey FOREIGN KEY (claimed_by_user_id) REFERENCES public.users(id),
  CONSTRAINT consultations_claimed_by_clinic_account_id_fkey FOREIGN KEY (claimed_by_clinic_account_id) REFERENCES public.clinic_accounts(id),
  CONSTRAINT consultations_completed_by_user_id_fkey FOREIGN KEY (completed_by_user_id) REFERENCES public.users(id),
  CONSTRAINT consultations_completed_by_clinic_account_id_fkey FOREIGN KEY (completed_by_clinic_account_id) REFERENCES public.clinic_accounts(id)
);
CREATE TABLE public.triage_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL,
  nurse_id uuid,
  temperature numeric,
  blood_pressure text,
  heart_rate integer,
  respiratory_rate integer,
  oxygen_saturation integer,
  weight numeric,
  height numeric,
  symptoms text,
  triage_level text CHECK (triage_level = ANY (ARRAY['red'::text, 'yellow'::text, 'green'::text])),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT triage_assessments_pkey PRIMARY KEY (id),
  CONSTRAINT triage_assessments_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id),
  CONSTRAINT triage_assessments_nurse_id_fkey FOREIGN KEY (nurse_id) REFERENCES public.clinic_accounts(id)
);
CREATE TABLE public.diagnoses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL,
  icd10_code text,
  description text,
  is_primary boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT diagnoses_pkey PRIMARY KEY (id),
  CONSTRAINT diagnoses_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id),
  CONSTRAINT diagnoses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.treatments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL,
  treatment_plan text,
  instructions text,
  follow_up_days integer,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT treatments_pkey PRIMARY KEY (id),
  CONSTRAINT treatments_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id),
  CONSTRAINT treatments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.follow_ups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL,
  scheduled_date date NOT NULL,
  reason text,
  status text DEFAULT 'scheduled'::text CHECK (status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text])),
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT follow_ups_pkey PRIMARY KEY (id),
  CONSTRAINT follow_ups_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id)
);
CREATE TABLE public.medicines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  generic_name text NOT NULL,
  brand_name text,
  category text,
  unit text NOT NULL,
  min_stock_level integer DEFAULT 10,
  is_controlled boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  approval_status text NOT NULL DEFAULT 'approved'::text CHECK (approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  created_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  CONSTRAINT medicines_pkey PRIMARY KEY (id),
  CONSTRAINT medicines_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT medicines_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id)
);
CREATE TABLE public.medicine_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  batch_number text,
  expiry_date date,
  location text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT medicine_stock_pkey PRIMARY KEY (id),
  CONSTRAINT medicine_stock_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES public.medicines(id)
);
CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT suppliers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.medicine_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL,
  batch_number text NOT NULL,
  quantity integer NOT NULL,
  expiry_date date NOT NULL,
  supplier_id uuid,
  received_date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT medicine_batches_pkey PRIMARY KEY (id),
  CONSTRAINT medicine_batches_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES public.medicines(id),
  CONSTRAINT medicine_batches_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id)
);
CREATE TABLE public.prescriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL,
  medicine_id uuid NOT NULL,
  dosage text,
  frequency text,
  duration_days integer,
  quantity integer,
  instructions text,
  prescribed_by uuid,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'dispensed'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  protocol_version_id uuid,
  protocol_approved_by uuid,
  CONSTRAINT prescriptions_pkey PRIMARY KEY (id),
  CONSTRAINT prescriptions_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id),
  CONSTRAINT prescriptions_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES public.medicines(id),
  CONSTRAINT prescriptions_prescribed_by_fkey FOREIGN KEY (prescribed_by) REFERENCES public.users(id),
  CONSTRAINT prescriptions_protocol_version_id_fkey FOREIGN KEY (protocol_version_id) REFERENCES public.clinical_protocol_versions(id),
  CONSTRAINT prescriptions_protocol_approved_by_fkey FOREIGN KEY (protocol_approved_by) REFERENCES public.clinic_accounts(id)
);
CREATE TABLE public.dispensing_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL,
  medicine_stock_id uuid NOT NULL,
  dispensed_by uuid,
  quantity integer NOT NULL,
  dispensed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dispensing_logs_pkey PRIMARY KEY (id),
  CONSTRAINT dispensing_logs_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id),
  CONSTRAINT dispensing_logs_medicine_stock_id_fkey FOREIGN KEY (medicine_stock_id) REFERENCES public.medicine_stock(id),
  CONSTRAINT dispensing_logs_dispensed_by_fkey FOREIGN KEY (dispensed_by) REFERENCES public.users(id)
);
CREATE TABLE public.restock_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL,
  quantity integer NOT NULL,
  requested_by uuid,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'fulfilled'::text])),
  approved_by uuid,
  supplier_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restock_requests_pkey PRIMARY KEY (id),
  CONSTRAINT restock_requests_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES public.medicines(id),
  CONSTRAINT restock_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id),
  CONSTRAINT restock_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id),
  CONSTRAINT restock_requests_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id)
);
CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_type text NOT NULL,
  student_id uuid,
  faculty_id uuid,
  doctor_id uuid,
  reason text NOT NULL,
  symptoms text,
  priority integer,
  scheduled_date date,
  scheduled_time time without time zone,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'ai_evaluated'::text, 'recommended'::text, 'approved'::text, 'rejected'::text, 'scheduled'::text, 'reminded'::text, 'checked_in'::text, 'in_consultation'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  staff_id uuid,
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT appointments_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id),
  CONSTRAINT appointments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.clinic_accounts(id),
  CONSTRAINT appointments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id)
);
CREATE TABLE public.appointment_ai_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  priority_score integer,
  recommended_slot text,
  rationale text,
  ai_log_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT appointment_ai_evaluations_pkey PRIMARY KEY (id),
  CONSTRAINT appointment_ai_evaluations_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id),
  CONSTRAINT appointment_ai_evaluations_ai_log_id_fkey FOREIGN KEY (ai_log_id) REFERENCES public.ai_logs(id)
);
CREATE TABLE public.appointment_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  remind_at timestamp with time zone NOT NULL,
  sent_at timestamp with time zone,
  status text DEFAULT 'scheduled'::text CHECK (status = ANY (ARRAY['scheduled'::text, 'sent'::text, 'failed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT appointment_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT appointment_reminders_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id)
);
CREATE TABLE public.appointment_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  rfid_uid text,
  check_in_time timestamp with time zone DEFAULT now(),
  CONSTRAINT appointment_checkins_pkey PRIMARY KEY (id),
  CONSTRAINT appointment_checkins_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id)
);
CREATE TABLE public.incidents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_type text NOT NULL CHECK (patient_type = ANY (ARRAY['student'::text, 'faculty'::text])),
  student_id uuid,
  faculty_id uuid,
  incident_type text NOT NULL CHECK (incident_type = ANY (ARRAY['injury'::text, 'illness'::text, 'emergency'::text])),
  description text NOT NULL,
  location text,
  severity text CHECK (severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'severe'::text, 'critical'::text])),
  status text DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'in-progress'::text, 'closed'::text])),
  reported_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT incidents_pkey PRIMARY KEY (id),
  CONSTRAINT incidents_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id),
  CONSTRAINT incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id),
  CONSTRAINT incidents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.incident_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  action_taken text NOT NULL,
  responder_id uuid,
  response_time timestamp with time zone DEFAULT now(),
  CONSTRAINT incident_responses_pkey PRIMARY KEY (id),
  CONSTRAINT incident_responses_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id),
  CONSTRAINT incident_responses_responder_id_fkey FOREIGN KEY (responder_id) REFERENCES public.users(id)
);
CREATE TABLE public.incident_followups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  follow_up_date date,
  notes text,
  completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT incident_followups_pkey PRIMARY KEY (id),
  CONSTRAINT incident_followups_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id)
);
CREATE TABLE public.health_clearances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  requester_type text NOT NULL,
  student_id uuid,
  faculty_id uuid,
  purpose text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'evaluating'::text, 'approved'::text, 'rejected'::text])),
  expires_at date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  staff_id uuid,
  CONSTRAINT health_clearances_pkey PRIMARY KEY (id),
  CONSTRAINT health_clearances_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT health_clearances_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id),
  CONSTRAINT health_clearances_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id)
);
CREATE TABLE public.clearance_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clearance_id uuid NOT NULL,
  requested_by uuid,
  request_details text,
  status text DEFAULT 'submitted'::text CHECK (status = ANY (ARRAY['submitted'::text, 'processing'::text, 'evaluated'::text, 'completed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clearance_requests_pkey PRIMARY KEY (id),
  CONSTRAINT clearance_requests_clearance_id_fkey FOREIGN KEY (clearance_id) REFERENCES public.health_clearances(id),
  CONSTRAINT clearance_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id)
);
CREATE TABLE public.clearance_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clearance_id uuid NOT NULL,
  doctor_id uuid,
  result text NOT NULL CHECK (result = ANY (ARRAY['fit'::text, 'unfit'::text, 'conditional'::text])),
  medical_notes text,
  evaluated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clearance_evaluations_pkey PRIMARY KEY (id),
  CONSTRAINT clearance_evaluations_clearance_id_fkey FOREIGN KEY (clearance_id) REFERENCES public.health_clearances(id),
  CONSTRAINT clearance_evaluations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.clinic_accounts(id)
);
CREATE TABLE public.clearance_certificates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clearance_id uuid NOT NULL,
  certificate_number text NOT NULL UNIQUE,
  issued_by uuid,
  issued_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clearance_certificates_pkey PRIMARY KEY (id),
  CONSTRAINT clearance_certificates_clearance_id_fkey FOREIGN KEY (clearance_id) REFERENCES public.health_clearances(id),
  CONSTRAINT clearance_certificates_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id)
);
CREATE TABLE public.health_programs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  program_type text NOT NULL CHECK (program_type = ANY (ARRAY['immunization'::text, 'screening'::text, 'wellness'::text])),
  start_date date,
  end_date date,
  is_active boolean DEFAULT true,
  managed_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  workflow_status text NOT NULL DEFAULT 'active'::text CHECK (workflow_status = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text])),
  target_audience ARRAY NOT NULL DEFAULT ARRAY['student'::text, 'faculty'::text, 'staff'::text] CHECK (cardinality(target_audience) > 0 AND target_audience <@ ARRAY['student'::text, 'faculty'::text, 'staff'::text]),
  proposed_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  CONSTRAINT health_programs_pkey PRIMARY KEY (id),
  CONSTRAINT health_programs_managed_by_fkey FOREIGN KEY (managed_by) REFERENCES public.users(id),
  CONSTRAINT health_programs_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES public.users(id),
  CONSTRAINT health_programs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id)
);
CREATE TABLE public.program_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL,
  patient_type text NOT NULL CHECK (patient_type = ANY (ARRAY['student'::text, 'faculty'::text])),
  student_id uuid,
  faculty_id uuid,
  enrolled_at timestamp with time zone DEFAULT now(),
  CONSTRAINT program_participants_pkey PRIMARY KEY (id),
  CONSTRAINT program_participants_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.health_programs(id),
  CONSTRAINT program_participants_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT program_participants_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id)
);
CREATE TABLE public.program_screenings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL,
  screening_type text NOT NULL,
  result text,
  performed_by uuid,
  screened_at timestamp with time zone DEFAULT now(),
  CONSTRAINT program_screenings_pkey PRIMARY KEY (id),
  CONSTRAINT program_screenings_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.program_participants(id),
  CONSTRAINT program_screenings_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id)
);
CREATE TABLE public.program_immunizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL,
  vaccine_name text NOT NULL,
  dose_number integer,
  administered_date date,
  administered_by uuid,
  lot_number text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT program_immunizations_pkey PRIMARY KEY (id),
  CONSTRAINT program_immunizations_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.program_participants(id),
  CONSTRAINT program_immunizations_administered_by_fkey FOREIGN KEY (administered_by) REFERENCES public.users(id)
);
CREATE TABLE public.program_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL,
  metric_name text NOT NULL,
  metric_value numeric,
  metric_date date,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT program_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT program_analytics_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.health_programs(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid,
  receiver_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['appointment'::text, 'clearance'::text, 'consultation'::text, 'emergency'::text, 'incident'::text, 'inventory'::text, 'rfid'::text, 'service'::text, 'system'::text, 'visit_log'::text])),
  entity_type text,
  entity_id uuid,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id),
  CONSTRAINT notifications_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.ai_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  prompt text,
  response text,
  status text NOT NULL CHECK (status = ANY (ARRAY['success'::text, 'failed'::text, 'fallback'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_logs_pkey PRIMARY KEY (id),
  CONSTRAINT ai_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.appointment_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  recommended_by uuid NOT NULL,
  recommendation text NOT NULL CHECK (recommendation = ANY (ARRAY['approve'::text, 'reject'::text, 'reschedule'::text])),
  notes text,
  recommended_date date,
  recommended_time time without time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT appointment_recommendations_pkey PRIMARY KEY (id),
  CONSTRAINT appointment_recommendations_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id),
  CONSTRAINT appointment_recommendations_recommended_by_fkey FOREIGN KEY (recommended_by) REFERENCES public.users(id)
);
CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip_address text,
  user_agent text,
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  session_token_hash text NOT NULL CHECK (session_token_hash ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  image_url text,
  posted_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  target_audience ARRAY NOT NULL DEFAULT ARRAY['student'::text, 'faculty'::text, 'staff'::text],
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.users(id)
);
CREATE TABLE public.settings (
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL DEFAULT 'system'::text,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT settings_pkey PRIMARY KEY (key),
  CONSTRAINT settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other'::text CHECK (category = ANY (ARRAY['health_program'::text, 'medical_clearance'::text, 'consultation_service'::text, 'other'::text])),
  duration_minutes integer,
  price numeric,
  is_active boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamp with time zone,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT services_pkey PRIMARY KEY (id),
  CONSTRAINT services_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT services_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);
CREATE TABLE public.clinic_queue_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'waiting'::text CHECK (status = ANY (ARRAY['waiting'::text, 'claimed'::text, 'awaiting_doctor_review'::text, 'completed'::text, 'cancelled'::text])),
  priority smallint NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 2),
  priority_reason text,
  prioritized_by uuid,
  prioritized_at timestamp with time zone,
  claimed_by uuid,
  claimed_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clinic_queue_entries_pkey PRIMARY KEY (id),
  CONSTRAINT clinic_queue_entries_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.clinic_visits(id),
  CONSTRAINT clinic_queue_entries_prioritized_by_fkey FOREIGN KEY (prioritized_by) REFERENCES public.users(id),
  CONSTRAINT clinic_queue_entries_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES public.users(id)
);
CREATE TABLE public.consultation_drafts (
  consultation_id uuid NOT NULL,
  current_step text NOT NULL DEFAULT 'details'::text CHECK (current_step = ANY (ARRAY['details'::text, 'vitals'::text, 'notes'::text, 'diagnosis'::text, 'prescription'::text, 'follow_up'::text, 'review'::text])),
  draft_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT consultation_drafts_pkey PRIMARY KEY (consultation_id),
  CONSTRAINT consultation_drafts_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id),
  CONSTRAINT consultation_drafts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);
CREATE TABLE public.staff_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_account_id uuid NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_availability_pkey PRIMARY KEY (id),
  CONSTRAINT staff_availability_clinic_account_id_fkey FOREIGN KEY (clinic_account_id) REFERENCES public.clinic_accounts(id)
);
CREATE TABLE public.faculty_immunizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL,
  vaccine_name text NOT NULL,
  administered_date date,
  dose_number integer,
  lot_number text,
  administered_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT faculty_immunizations_pkey PRIMARY KEY (id),
  CONSTRAINT faculty_immunizations_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id),
  CONSTRAINT faculty_immunizations_administered_by_fkey FOREIGN KEY (administered_by) REFERENCES public.users(id)
);
CREATE TABLE public.faculty_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL,
  document_type text NOT NULL,
  file_url text NOT NULL,
  file_name text,
  mime_type text,
  file_size integer,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT faculty_documents_pkey PRIMARY KEY (id),
  CONSTRAINT faculty_documents_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id),
  CONSTRAINT faculty_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);
CREATE TABLE public.staff (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  employee_number text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  middle_name text,
  department text,
  position text,
  phone text,
  email text,
  address text,
  rfid_uid text UNIQUE,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  profile_photo_url text,
  CONSTRAINT staff_pkey PRIMARY KEY (id),
  CONSTRAINT staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.staff_medical_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  condition_name text NOT NULL,
  diagnosed_date date,
  status text DEFAULT 'active'::text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_medical_history_pkey PRIMARY KEY (id),
  CONSTRAINT staff_medical_history_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id),
  CONSTRAINT staff_medical_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.staff_allergies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  allergen text NOT NULL,
  reaction text,
  severity text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_allergies_pkey PRIMARY KEY (id),
  CONSTRAINT staff_allergies_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id),
  CONSTRAINT staff_allergies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.staff_medications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  medicine_name text NOT NULL,
  dosage text,
  frequency text,
  start_date date,
  end_date date,
  prescribed_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_medications_pkey PRIMARY KEY (id),
  CONSTRAINT staff_medications_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id),
  CONSTRAINT staff_medications_prescribed_by_fkey FOREIGN KEY (prescribed_by) REFERENCES public.users(id)
);
CREATE TABLE public.staff_immunizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  vaccine_name text NOT NULL,
  administered_date date,
  dose_number integer,
  lot_number text,
  administered_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_immunizations_pkey PRIMARY KEY (id),
  CONSTRAINT staff_immunizations_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id),
  CONSTRAINT staff_immunizations_administered_by_fkey FOREIGN KEY (administered_by) REFERENCES public.users(id)
);
CREATE TABLE public.staff_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  document_type text NOT NULL,
  file_url text NOT NULL,
  file_name text,
  mime_type text,
  file_size integer,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_documents_pkey PRIMARY KEY (id),
  CONSTRAINT staff_documents_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id),
  CONSTRAINT staff_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);
CREATE TABLE public.clinician_schedule_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_account_id uuid NOT NULL,
  blocked_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clinician_schedule_blocks_pkey PRIMARY KEY (id),
  CONSTRAINT clinician_schedule_blocks_clinic_account_id_fkey FOREIGN KEY (clinic_account_id) REFERENCES public.clinic_accounts(id),
  CONSTRAINT clinician_schedule_blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.medical_exam_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_role text NOT NULL CHECK (patient_role = ANY (ARRAY['student'::text, 'faculty'::text, 'staff'::text])),
  student_id uuid,
  faculty_id uuid,
  staff_id uuid,
  school_year text,
  semester text,
  calendar_year integer,
  clinical_result_status text,
  exam_details text NOT NULL,
  result_storage_path text NOT NULL,
  result_file_name text NOT NULL,
  result_mime_type text NOT NULL,
  result_file_size integer NOT NULL CHECK (result_file_size > 0),
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT medical_exam_results_pkey PRIMARY KEY (id),
  CONSTRAINT medical_exam_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT medical_exam_results_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id),
  CONSTRAINT medical_exam_results_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id),
  CONSTRAINT medical_exam_results_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);
CREATE TABLE public.sick_leave_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_role text NOT NULL CHECK (patient_role = ANY (ARRAY['faculty'::text, 'staff'::text])),
  faculty_id uuid,
  staff_id uuid,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason_diagnosis text NOT NULL,
  certificate_storage_path text NOT NULL,
  certificate_file_name text NOT NULL,
  certificate_mime_type text NOT NULL,
  certificate_file_size integer NOT NULL CHECK (certificate_file_size > 0),
  authored_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sick_leave_entries_pkey PRIMARY KEY (id),
  CONSTRAINT sick_leave_entries_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id),
  CONSTRAINT sick_leave_entries_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id),
  CONSTRAINT sick_leave_entries_authored_by_fkey FOREIGN KEY (authored_by) REFERENCES public.users(id)
);
CREATE TABLE public.complaints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT complaints_pkey PRIMARY KEY (id)
);
CREATE TABLE public.doctor_prescription_favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  doctor_clinic_account_id uuid NOT NULL,
  medicine_id uuid NOT NULL,
  label text NOT NULL CHECK (char_length(btrim(label)) >= 1 AND char_length(btrim(label)) <= 80),
  dosage text CHECK (dosage IS NULL OR char_length(dosage) <= 100),
  frequency text CHECK (frequency IS NULL OR char_length(frequency) <= 100),
  duration_days integer CHECK (duration_days >= 1 AND duration_days <= 365),
  quantity integer CHECK (quantity >= 1 AND quantity <= 1000),
  instructions text CHECK (instructions IS NULL OR char_length(instructions) <= 1000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT doctor_prescription_favorites_pkey PRIMARY KEY (id),
  CONSTRAINT doctor_prescription_favorites_doctor_clinic_account_id_fkey FOREIGN KEY (doctor_clinic_account_id) REFERENCES public.clinic_accounts(id),
  CONSTRAINT doctor_prescription_favorites_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES public.medicines(id)
);
CREATE TABLE public.clinician_duty_status (
  clinic_account_id uuid NOT NULL,
  is_on_duty boolean NOT NULL DEFAULT false,
  expires_at timestamp with time zone,
  updated_by uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clinician_duty_status_pkey PRIMARY KEY (clinic_account_id),
  CONSTRAINT clinician_duty_status_clinic_account_id_fkey FOREIGN KEY (clinic_account_id) REFERENCES public.clinic_accounts(id),
  CONSTRAINT clinician_duty_status_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);
CREATE TABLE public.portal_login_identities (
  login_id text NOT NULL CHECK (login_id ~ '^[se][0-9]{9}$'::text),
  user_id uuid NOT NULL UNIQUE,
  profile_role text NOT NULL CHECK (profile_role = ANY (ARRAY['student'::text, 'faculty'::text, 'staff'::text])),
  profile_id uuid NOT NULL,
  login_role text NOT NULL CHECK (login_role = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text, 'student'::text, 'faculty'::text, 'staff'::text])),
  temporary_password boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT portal_login_identities_pkey PRIMARY KEY (login_id),
  CONSTRAINT portal_login_identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.institutional_id_reservations (
  identity_kind text NOT NULL CHECK (identity_kind = ANY (ARRAY['student'::text, 'employee'::text])),
  official_number text NOT NULL CHECK (official_number ~ '^[0-9]{9}$'::text),
  rfid_uid text NOT NULL UNIQUE,
  profile_role text NOT NULL CHECK (profile_role = ANY (ARRAY['student'::text, 'faculty'::text, 'staff'::text])),
  profile_id uuid,
  reserved_at timestamp with time zone NOT NULL DEFAULT now(),
  confirmed_at timestamp with time zone,
  CONSTRAINT institutional_id_reservations_pkey PRIMARY KEY (identity_kind, official_number)
);
CREATE TABLE public.diagnosis_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL CHECK (char_length(btrim(code)) >= 1 AND char_length(btrim(code)) <= 20),
  description text NOT NULL CHECK (char_length(btrim(description)) >= 1 AND char_length(btrim(description)) <= 500),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT diagnosis_catalog_pkey PRIMARY KEY (id)
);
CREATE TABLE public.medicine_dosage_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL,
  dosage text NOT NULL CHECK (char_length(btrim(dosage)) >= 1 AND char_length(btrim(dosage)) <= 100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT medicine_dosage_options_pkey PRIMARY KEY (id),
  CONSTRAINT medicine_dosage_options_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES public.medicines(id)
);
CREATE TABLE public.visitors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name text NOT NULL CHECK (length(TRIM(BOTH FROM first_name)) >= 1 AND length(TRIM(BOTH FROM first_name)) <= 150),
  last_name text NOT NULL DEFAULT ''::text CHECK (length(last_name) <= 150),
  category text NOT NULL CHECK (category = ANY (ARRAY['parent'::text, 'guardian'::text, 'visitor'::text])),
  birth_date date,
  age_years integer CHECK (age_years >= 0 AND age_years <= 130),
  phone text CHECK (length(phone) <= 30),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT visitors_pkey PRIMARY KEY (id),
  CONSTRAINT visitors_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.clinical_protocol_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(title) >= 3 AND length(title) <= 150),
  version integer NOT NULL CHECK (version > 0),
  rules jsonb NOT NULL,
  approved_by uuid,
  approved_at timestamp with time zone,
  enabled boolean NOT NULL DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clinical_protocol_versions_pkey PRIMARY KEY (id),
  CONSTRAINT clinical_protocol_versions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.clinic_accounts(id),
  CONSTRAINT clinical_protocol_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.consultation_coordination_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL,
  milestone text NOT NULL CHECK (milestone = ANY (ARRAY['patient_contact_pending'::text, 'patient_contact_completed'::text, 'doctor_review_requested'::text, 'patient_doctor_discussion_completed'::text, 'outcome_recorded'::text, 'nurse_assigned'::text, 'nurse_acknowledged'::text])),
  note text NOT NULL DEFAULT ''::text CHECK (length(note) <= 1000),
  actor_id uuid NOT NULL,
  request_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT consultation_coordination_events_pkey PRIMARY KEY (id),
  CONSTRAINT consultation_coordination_events_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id),
  CONSTRAINT consultation_coordination_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id)
);
CREATE TABLE public.consultation_assessment_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(title) >= 3 AND length(title) <= 150),
  vital_keys ARRAY NOT NULL DEFAULT '{}'::text[] CHECK (vital_keys <@ ARRAY['temperature'::text, 'blood_pressure'::text, 'heart_rate'::text, 'respiratory_rate'::text, 'oxygen_saturation'::text]),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT consultation_assessment_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT consultation_assessment_profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.consultation_assessment_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL,
  values jsonb NOT NULL,
  recorded_by uuid,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT consultation_assessment_history_pkey PRIMARY KEY (id),
  CONSTRAINT consultation_assessment_history_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id),
  CONSTRAINT consultation_assessment_history_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id)
);
CREATE TABLE public.clinic_form_settings (
  singleton boolean NOT NULL DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT clinic_form_settings_pkey PRIMARY KEY (singleton)
);
CREATE TABLE public.clinic_form_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  fields jsonb NOT NULL,
  published_by uuid,
  published_at timestamp with time zone,
  CONSTRAINT clinic_form_templates_pkey PRIMARY KEY (id),
  CONSTRAINT clinic_form_templates_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.users(id)
);
CREATE TABLE public.clinic_forms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  consultation_id uuid,
  issued_by uuid NOT NULL,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  paper_size text NOT NULL CHECK (paper_size = ANY (ARRAY['A4'::text, 'Letter'::text])),
  prefill jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT clinic_forms_pkey PRIMARY KEY (id),
  CONSTRAINT clinic_forms_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.clinic_form_templates(id),
  CONSTRAINT clinic_forms_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id),
  CONSTRAINT clinic_forms_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id)
);
CREATE TABLE public.clinic_form_scans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  content_hash text NOT NULL CHECK (length(content_hash) = 64),
  mime_type text NOT NULL CHECK (mime_type = ANY (ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text])),
  uploaded_by uuid NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'queued'::text CHECK (state = ANY (ARRAY['queued'::text, 'processing'::text, 'review'::text, 'failed'::text, 'imported'::text])),
  attempt integer NOT NULL DEFAULT 0,
  lease_id uuid,
  lease_until timestamp with time zone,
  extracted jsonb,
  failure_code text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  reviewed_values jsonb,
  consultation_version timestamp with time zone,
  CONSTRAINT clinic_form_scans_pkey PRIMARY KEY (id),
  CONSTRAINT clinic_form_scans_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.clinic_forms(id),
  CONSTRAINT clinic_form_scans_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id),
  CONSTRAINT clinic_form_scans_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id)
);
CREATE TABLE public.consultation_form_imports (
  scan_id uuid NOT NULL,
  consultation_id uuid NOT NULL,
  reviewed_values jsonb NOT NULL,
  reviewed_by uuid NOT NULL,
  reviewed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT consultation_form_imports_pkey PRIMARY KEY (scan_id),
  CONSTRAINT consultation_form_imports_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.clinic_form_scans(id),
  CONSTRAINT consultation_form_imports_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id),
  CONSTRAINT consultation_form_imports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id)
);
