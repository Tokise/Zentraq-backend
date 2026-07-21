-- Seed data for dashboard demo

insert into clinic_profiles (rfid_uid, student_number, first_name, last_name, email, department, active_status)
values
  ('A1B2C3D4', '2021-00001', 'Maria', 'Santos', 'maria.santos@school.edu', 'College of Engineering', true),
  ('E5F6G7H8', '2021-00002', 'Juan', 'Dela Cruz', 'juan.delacruz@school.edu', 'College of Science', true),
  ('I9J0K1L2', '2022-00003', 'Ana', 'Reyes', 'ana.reyes@school.edu', 'College of Arts', true),
  ('M3N4O5P6', '2020-00004', 'Pedro', 'Lim', 'pedro.lim@school.edu', 'College of Business', true),
  ('Q7R8S9T0', '2023-00005', 'Sofia', 'Garcia', 'sofia.garcia@school.edu', 'College of Education', true)
on conflict (rfid_uid) do nothing;

insert into appointments (patient_name, appointment_time, appointment_type, status)
values
  ('Maria Santos', now() + interval '0 hours', 'General Checkup', 'completed'),
  ('Juan Dela Cruz', now() + interval '1 hour', 'Follow-up', 'in_progress'),
  ('Ana Reyes', now() + interval '2 hours', 'Health Clearance', 'scheduled'),
  ('Carlos Mendoza', now() + interval '3 hours', 'Vaccination', 'scheduled'),
  ('Sofia Garcia', now() + interval '4 hours', 'Consultation', 'scheduled');

insert into consultations (patient_name, chief_complaint, status)
values
  ('Maria Santos', 'Headache, mild fever', 'completed'),
  ('Juan Dela Cruz', 'Sprained ankle', 'active'),
  ('Pedro Lim', 'Allergic reaction', 'emergency'),
  ('Lisa Tan', 'Sore throat', 'completed');

insert into medicines (name, current_stock, minimum_stock)
values
  ('Paracetamol 500mg', 12, 50),
  ('Amoxicillin 250mg', 28, 40),
  ('Ibuprofen 400mg', 35, 50);

insert into inventory_alerts (medicine_name, current_stock, minimum_stock, severity)
values
  ('Paracetamol 500mg', 12, 50, 'critical'),
  ('Amoxicillin 250mg', 28, 40, 'warning'),
  ('Ibuprofen 400mg', 35, 50, 'warning');

-- Admin Profile Setup
-- Note: The actual Auth User must be created via the Supabase Dashboard or CLI for this to work.
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@zentraq.com' LIMIT 1;
    
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, email, role)
        VALUES (admin_user_id, 'admin@zentraq.com', 'admin')
        ON CONFLICT (id) DO UPDATE SET role = 'admin';
    END IF;
END $$;
