-- Rename chief_complaint to student_complaint in consultations table
ALTER TABLE consultations RENAME COLUMN chief_complaint TO student_complaint;

-- Rename chief_complaint to student_complaint in visit_logs table
ALTER TABLE visit_logs RENAME COLUMN chief_complaint TO student_complaint;