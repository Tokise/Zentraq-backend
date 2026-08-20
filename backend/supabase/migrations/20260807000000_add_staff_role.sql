-- Adds the staff portal role with the same baseline access as faculty.
INSERT INTO public.roles (name, description, is_deletable)
VALUES ('staff', 'Staff member with the same baseline portal access as faculty', true)
ON CONFLICT (name) DO NOTHING;

-- Copies the faculty role's current permissions so Staff remains aligned with Faculty.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT staff_role.id, faculty_permission.permission_id
FROM public.roles AS staff_role
JOIN public.roles AS faculty_role ON faculty_role.name = 'faculty'
JOIN public.role_permissions AS faculty_permission ON faculty_permission.role_id = faculty_role.id
WHERE staff_role.name = 'staff'
ON CONFLICT (role_id, permission_id) DO NOTHING;
