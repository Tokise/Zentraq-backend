- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.consultations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  patient_name text NOT NULL,
  student_complaint text,
  status text NOT NULL DEFAULT 'waiting'::text CHECK (status = ANY (ARRAY['waiting'::text, 'in_consultation'::text, 'in_emergency'::text, 'completed'::text, 'dismissed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  handled_at timestamp with time zone,
  notes text,
  handled_by uuid,
  origin text NOT NULL DEFAULT 'consultation'::text CHECK (origin = ANY (ARRAY['consultation'::text, 'emergency'::text])),
  queue_number text,
  CONSTRAINT consultations_pkey PRIMARY KEY (id),
  CONSTRAINT consultations_handled_by_fkey FOREIGN KEY (handled_by) REFERENCES auth.users(id)
);
CREATE TABLE public.clinic_accounts (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  role USER-DEFINED DEFAULT 'patient'::user_role,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  current_session_token text,
  CONSTRAINT clinic_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.visit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  consultation_id uuid,
  patient_name text NOT NULL,
  student_complaint text NOT NULL,
  origin text NOT NULL CHECK (origin = ANY (ARRAY['consultation'::text, 'emergency'::text])),
  diagnosis text NOT NULL DEFAULT ''::text,
  treatment text NOT NULL DEFAULT ''::text,
  recommendations text NOT NULL DEFAULT ''::text,
  handled_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'completed'::text CHECK (status = ANY (ARRAY['waiting'::text, 'in_progress'::text, 'emergency'::text, 'completed'::text, 'return_to_class'::text, 'return_to_activity'::text, 'sent_home'::text])),
  CONSTRAINT visit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT visit_logs_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id)
);
CREATE TABLE public.complaints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT complaints_pkey PRIMARY KEY (id)
);
CREATE TABLE public.student_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  rfid_uid text UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  student_number text UNIQUE,
  employee_number text,
  department text,
  course text,
  year_level text,
  position text,
  clinic_photo_url text,
  active_status boolean DEFAULT true,
  archived_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  current_session_token text,
  CONSTRAINT student_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT student_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  posted_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  image_url text,
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES auth.users(id)
);
CREATE TABLE public.student_appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_user_id uuid,
  student_account_id uuid,
  appointment_date date NOT NULL,
  time_slot text NOT NULL,
  reason text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_appointments_pkey PRIMARY KEY (id),
  CONSTRAINT student_appointments_student_user_id_fkey FOREIGN KEY (student_user_id) REFERENCES auth.users(id),
  CONSTRAINT student_appointments_student_account_id_fkey FOREIGN KEY (student_account_id) REFERENCES public.student_accounts(id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid,
  email text,
  action text NOT NULL,
  resource text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
Compose
Write to Johnrey Ablen
