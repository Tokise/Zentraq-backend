-- Patient Medical Record View
-- Provides unified view of student and faculty medical data for the frontend
CREATE OR REPLACE VIEW v_patient_medical_record AS
SELECT 
    s.id AS patient_id,
    s.student_number AS identifier,
    s.first_name,
    s.last_name,
    s.middle_name,
    s.department,
    s.course,
    s.year_level,
    s.section,
    s.birth_date,
    s.gender,
    s.blood_type,
    s.phone,
    s.email,
    s.address,
    s.emergency_contact_name,
    s.emergency_contact_phone,
    s.guardian_name,
    s.guardian_phone,
    s.rfid_uid,
    s.profile_photo_url,
    'student' AS patient_type,
    COALESCE(
        json_agg(
            json_build_object(
                'id', smh.id,
                'condition', smh.condition_name,
                'diagnosed_date', smh.diagnosed_date,
                'status', smh.status,
                'notes', smh.notes,
                'created_by', smh.created_by,
                'created_at', smh.created_at
            )
        ) FILTER (WHERE smh.id IS NOT NULL),
        '[]'::json
    ) AS medical_history,
    COALESCE(
        json_agg(
            json_build_object(
                'id', sa.id,
                'allergen', sa.allergen,
                'reaction', sa.reaction,
                'severity', sa.severity,
                'notes', sa.notes,
                'created_by', sa.created_by,
                'created_at', sa.created_at
            )
        ) FILTER (WHERE sa.id IS NOT NULL),
        '[]'::json
    ) AS allergies,
    COALESCE(
        json_agg(
            json_build_object(
                'id', smed.id,
                'medicine_name', smed.medicine_name,
                'dosage', smed.dosage,
                'frequency', smed.frequency,
                'start_date', smed.start_date,
                'end_date', smed.end_date,
                'prescribed_by', smed.prescribed_by,
                'notes', smed.notes,
                'created_at', smed.created_at
            )
        ) FILTER (WHERE smed.id IS NOT NULL),
        '[]'::json
    ) AS medications,
    COALESCE(
        json_agg(
            json_build_object(
                'id', si.id,
                'vaccine_name', si.vaccine_name,
                'administered_date', si.administered_date,
                'dose_number', si.dose_number,
                'lot_number', si.lot_number,
                'administered_by', si.administered_by,
                'notes', si.notes,
                'created_at', si.created_at
            )
        ) FILTER (WHERE si.id IS NOT NULL),
        '[]'::json
    ) AS immunizations
FROM students s
LEFT JOIN student_medical_history smh ON s.id = smh.student_id
LEFT JOIN student_allergies sa ON s.id = sa.student_id
LEFT JOIN student_medications smed ON s.id = smed.student_id
LEFT JOIN student_immunizations si ON s.id = si.student_id
GROUP BY 
    s.id, s.student_number, s.first_name, s.last_name, s.middle_name,
    s.department, s.course, s.year_level, s.section, s.birth_date,
    s.gender, s.blood_type, s.phone, s.email, s.address,
    s.emergency_contact_name, s.emergency_contact_phone,
    s.guardian_name, s.guardian_phone, s.rfid_uid, s.profile_photo_url

UNION ALL

SELECT 
    f.id AS patient_id,
    f.employee_number AS identifier,
    f.first_name,
    f.last_name,
    f.middle_name,
    f.department,
    f.position AS course,
    NULL AS year_level,
    NULL AS section,
    NULL AS birth_date,
    NULL AS gender,
    NULL AS blood_type,
    f.phone,
    f.email,
    f.address,
    NULL AS emergency_contact_name,
    NULL AS emergency_contact_phone,
    NULL AS guardian_name,
    NULL AS guardian_phone,
    f.rfid_uid,
    NULL AS profile_photo_url,
    'faculty' AS patient_type,
    COALESCE(
        json_agg(
            json_build_object(
                'id', fmh.id,
                'condition', fmh.condition_name,
                'diagnosed_date', fmh.diagnosed_date,
                'status', fmh.status,
                'notes', fmh.notes,
                'created_by', fmh.created_by,
                'created_at', fmh.created_at
            )
        ) FILTER (WHERE fmh.id IS NOT NULL),
        '[]'::json
    ) AS medical_history,
    COALESCE(
        json_agg(
            json_build_object(
                'id', fa.id,
                'allergen', fa.allergen,
                'reaction', fa.reaction,
                'severity', fa.severity,
                'notes', fa.notes,
                'created_by', fa.created_by,
                'created_at', fa.created_at
            )
        ) FILTER (WHERE fa.id IS NOT NULL),
        '[]'::json
    ) AS allergies,
    COALESCE(
        json_agg(
            json_build_object(
                'id', fmed.id,
                'medicine_name', fmed.medicine_name,
                'dosage', fmed.dosage,
                'frequency', fmed.frequency,
                'start_date', fmed.start_date,
                'end_date', fmed.end_date,
                'prescribed_by', fmed.prescribed_by,
                'notes', fmed.notes,
                'created_at', fmed.created_at
            )
        ) FILTER (WHERE fmed.id IS NOT NULL),
        '[]'::json
    ) AS medications,
    '[]'::json AS immunizations
FROM faculty f
LEFT JOIN faculty_medical_history fmh ON f.id = fmh.faculty_id
LEFT JOIN faculty_allergies fa ON f.id = fa.faculty_id
LEFT JOIN faculty_medications fmed ON f.id = fmed.faculty_id
GROUP BY 
    f.id, f.employee_number, f.first_name, f.last_name, f.middle_name,
    f.department, f.position, f.phone, f.email, f.address,
    f.rfid_uid;

-- Daily Consultations View for Analytics
CREATE OR REPLACE VIEW v_daily_consultations AS
SELECT 
    DATE(cv.created_at) AS consultation_date,
    COUNT(*) AS total_consultations,
    COUNT(CASE WHEN cv.patient_type = 'student' THEN 1 END) AS student_consultations,
    COUNT(CASE WHEN cv.patient_type = 'faculty' THEN 1 END) AS faculty_consultations,
    COUNT(CASE WHEN cv.visit_type = 'walk-in' THEN 1 END) AS walk_in_visits,
    COUNT(CASE WHEN cv.visit_type = 'appointment' THEN 1 END) AS appointment_visits,
    COUNT(CASE WHEN cv.visit_type = 'rfid' THEN 1 END) AS rfid_visits
FROM clinic_visits cv
GROUP BY DATE(cv.created_at)
ORDER BY consultation_date DESC;

-- Complaint Frequency View for Analytics
CREATE OR REPLACE VIEW v_complaint_frequency AS
SELECT 
    COALESCE(c.chief_complaint, 'Unspecified') AS complaint,
    COUNT(*) AS frequency
FROM consultations c
WHERE c.chief_complaint IS NOT NULL
GROUP BY c.chief_complaint
ORDER BY frequency DESC
LIMIT 50;

-- Medicine Dispensing Summary View for Analytics
CREATE OR REPLACE VIEW v_dispensing_summary AS
SELECT 
    m.id AS medicine_id,
    m.generic_name,
    m.brand_name,
    m.category,
    COUNT(dl.id) AS total_dispensed,
    SUM(dl.quantity) AS total_quantity_dispensed,
    MIN(dl.dispensed_at) AS first_dispensed,
    MAX(dl.dispensed_at) AS last_dispensed
FROM medicines m
LEFT JOIN prescriptions p ON m.id = p.medicine_id
LEFT JOIN dispensing_logs dl ON p.id = dl.prescription_id
GROUP BY m.id, m.generic_name, m.brand_name, m.category
ORDER BY total_quantity_dispensed DESC;

-- Clearance Completion View for Compliance Analytics
CREATE OR REPLACE VIEW v_clearance_completion AS
SELECT 
    hc.requester_type,
    COUNT(*) AS total_requests,
    COUNT(CASE WHEN hc.status = 'approved' THEN 1 END) AS approved,
    COUNT(CASE WHEN hc.status = 'rejected' THEN 1 END) AS rejected,
    COUNT(CASE WHEN hc.status = 'pending' THEN 1 END) AS pending,
    COUNT(CASE WHEN hc.status = 'evaluating' THEN 1 END) AS evaluating,
    ROUND(
        (COUNT(CASE WHEN hc.status = 'approved' THEN 1 END)::numeric / NULLIF(COUNT(*), 0)) * 100,
        2
    ) AS approval_rate
FROM health_clearances hc
GROUP BY hc.requester_type;
