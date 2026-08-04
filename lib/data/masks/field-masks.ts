// ============================================
// ZenTraq Field Masking Utilities
// Based on SAD §14 Sensitive Data Exposure & Privacy Policy
// ============================================

/**
 * Default mask character for sensitive fields
 */
export const DEFAULT_MASK = '••••••••';

/**
 * Mask patterns for different field types
 */
export type MaskFieldType = keyof typeof MASK_PATTERNS;

export const MASK_PATTERNS = {
    // Identifier masks
    studentNumber: (value: string) => maskPartial(value, 2, 2),
    employeeNumber: (value: string) => maskPartial(value, 2, 2),
    rfidUid: (value: string) => maskPartial(value, 2, 2),

    // Contact masks
    email: (value: string) => maskEmail(value),
    phone: (value: string) => maskPhone(value),
    address: (value: string) => maskPartial(value, 3, 0),

    // Emergency contact masks
    emergencyContactName: (value: string) => maskName(value),
    emergencyContactPhone: (value: string) => maskPhone(value),
    guardianName: (value: string) => maskName(value),
    guardianPhone: (value: string) => maskPhone(value),

    // Medical masks
    medicalNotes: (value: string) => DEFAULT_MASK,
    diagnosis: (value: string) => DEFAULT_MASK,
    prescription: (value: string) => DEFAULT_MASK,
    allergy: (value: string) => DEFAULT_MASK,

    // System masks
    sessionToken: (value: string) => DEFAULT_MASK,
    internalId: (value: string) => DEFAULT_MASK,
} as const;

/**
 * Masks a string by showing only first and last N characters
 */
export function maskPartial(value: string, showStart: number = 2, showEnd: number = 2): string {
    if (!value || value.length <= showStart + showEnd) {
        return DEFAULT_MASK;
    }
    const start = value.slice(0, showStart);
    const end = value.slice(-showEnd);
    const middleLength = value.length - showStart - showEnd;
    return start + '•'.repeat(Math.min(middleLength, 8)) + end;
}

/**
 * Masks an email address (e.g., john.doe@example.com → jo***@example.com)
 */
export function maskEmail(email: string): string {
    if (!email || !email.includes('@')) return DEFAULT_MASK;

    const [local, domain] = email.split('@');
    if (local.length <= 2) return `**@${domain}`;

    return `${local.slice(0, 2)}${'*'.repeat(Math.min(local.length - 2, 6))}@${domain}`;
}

/**
 * Masks a phone number (e.g., +639123456789 → +63*****6789)
 */
export function maskPhone(phone: string): string {
    if (!phone) return DEFAULT_MASK;

    // Remove non-digits for counting
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 4) return DEFAULT_MASK;

    // Keep country code (if starts with +) and last 4 digits
    const hasCountryCode = phone.startsWith('+');
    const prefix = hasCountryCode ? phone.slice(0, phone.indexOf(digits[0]) + 1) : '';
    const maskedLength = digits.length - (hasCountryCode ? 1 : 0) - 4;

    return prefix + '*'.repeat(Math.min(maskedLength, 6)) + digits.slice(-4);
}

/**
 * Masks a name (e.g., "John Doe" → "J*** D**")
 */
export function maskName(name: string): string {
    if (!name) return DEFAULT_MASK;

    return name
        .split(' ')
        .map(part => {
            if (part.length <= 1) return part;
            return part[0] + '*'.repeat(Math.min(part.length - 1, 4));
        })
        .join(' ');
}

/**
 * Gets the appropriate mask function for a field type
 */
export function getMaskFunction(fieldType: keyof typeof MASK_PATTERNS) {
    return MASK_PATTERNS[fieldType] || (() => DEFAULT_MASK);
}

/**
 * Checks if a field should be masked by default
 */
export const SENSITIVE_FIELDS = new Set([
    // Identifiers
    'student_number',
    'employee_number',
    'rfid_uid',

    // Contact
    'email',
    'phone',
    'address',
    'birth_date',

    // Emergency
    'emergency_contact_name',
    'emergency_contact_phone',
    'guardian_name',
    'guardian_phone',

    // Medical
    'medical_history',
    'allergies',
    'medications',
    'immunizations',
    'consultation_notes',
    'diagnosis',
    'treatment_plan',
    'prescription_details',
    'icd10_code',
    'blood_type',

    // System
    'session_token',
    'session_token',
    'internal_id',
    'audit_metadata',
]);

/**
 * Checks if a field is sensitive and should be masked by default
 */
export function isSensitiveField(fieldName: string): boolean {
    return SENSITIVE_FIELDS.has(fieldName);
}

/**
 * Applies masking to an object based on field names
 */
export function maskObject<T extends Record<string, unknown>>(
    obj: T,
    fieldsToMask?: string[]
): T {
    const result = { ...obj } as T;
    const sensitiveFields = fieldsToMask || Array.from(SENSITIVE_FIELDS);

    for (const field of sensitiveFields) {
        if (field in result && result[field] != null) {
            const value = result[field];
            if (typeof value === 'string') {
                const maskFn = getMaskFunction(field as keyof typeof MASK_PATTERNS);
                (result as Record<string, unknown>)[field] = maskFn(value);
            } else if (Array.isArray(value)) {
                // For arrays of objects, mask each object
                (result as Record<string, unknown>)[field] = value.map(item =>
                    typeof item === 'object' && item !== null
                        ? maskObject(item as Record<string, unknown>)
                        : item
                );
            }
        }
    }

    return result;
}

/**
 * Creates a masked version of a student object for public display
 */
export function createStudentPublicDTO(student: Record<string, unknown>) {
    return {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        department: student.department,
        course: student.course,
        year_level: student.year_level,
        status: student.status,
        profile_photo_url: student.profile_photo_url,
    };
}

/**
 * Creates a masked version of a faculty object for public display
 */
export function createFacultyPublicDTO(faculty: Record<string, unknown>) {
    return {
        id: faculty.id,
        first_name: faculty.first_name,
        last_name: faculty.last_name,
        department: faculty.department,
        position: faculty.position,
        status: faculty.status,
    };
}

/**
 * Auto-hide delay for sensitive field reveal (30 seconds per SAD §14.5)
 */
export const AUTO_HIDE_DELAY_MS = 30000;
