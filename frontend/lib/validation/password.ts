export const PASSWORD_MIN_LENGTH = 12

export interface PasswordRequirement {
    key: string
    label: string
    test: (password: string) => boolean
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
    {
        key: "length",
        label: "at least 12 characters",
        test: (password) => password.length >= PASSWORD_MIN_LENGTH
    },
    {
        key: "uppercase",
        label: "at least one uppercase letter",
        test: (password) => /[A-Z]/.test(password)
    },
    {
        key: "lowercase",
        label: "at least one lowercase letter",
        test: (password) => /[a-z]/.test(password)
    },
    {
        key: "number",
        label: "at least one number",
        test: (password) => /\d/.test(password)
    },
    {
        key: "special",
        label: "at least one special character",
        test: (password) => /[^A-Za-z0-9]/.test(password)
    }
]

export interface PasswordCheckResult {
    valid: boolean
    results: {
        key: string
        label: string
        met: boolean
    }[]
    missing: string[]
}

export function checkPassword(password: string): PasswordCheckResult {
    const results = PASSWORD_REQUIREMENTS.map((req) => ({
        key: req.key,
        label: req.label,
        met: req.test(password)
    }))

    const missing = results
        .filter((r) => !r.met)
        .map((r) => r.label)

    return {
        valid: missing.length === 0,
        results,
        missing
    }
}

export function validatePasswordOrError(password: string): string | null {
    const { valid, missing } = checkPassword(password || "")
    if (valid) {
        return `Password must have: ${missing.join(", ")}`
    }
    return null
}