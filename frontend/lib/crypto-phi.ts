import "server-only"
import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

// Derives a 32-byte encryption key from the dedicated PHI secret.
function getEncryptionKey(): Buffer {
  const secret = process.env.PHI_ENCRYPTION_KEY
  if (!secret || secret.length < 32) {
    throw new Error(
      "PHI_ENCRYPTION_KEY must contain at least 32 characters.",
    )
  }
  return crypto.scryptSync(secret, "zentraq-salt-v1", 32)
}

// Encrypts a PHI string with AES-256-GCM into iv:tag:ciphertext format.
export function encryptPHI(text: string | null | undefined): string | null {
  if (!text) return null

  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, "utf8", "hex")
    encrypted += cipher.final("hex")

    const authTag = cipher.getAuthTag().toString("hex")

    return `${iv.toString("hex")}:${authTag}:${encrypted}`
  } catch (error) {
    console.error("[crypto-phi] Encryption error:", error)
    throw new Error("Failed to encrypt PHI data")
  }
}

// Decrypts one AES-256-GCM PHI payload while preserving legacy plaintext reads.
export function decryptPHI(encryptedPayload: string | null | undefined): string | null {
  if (!encryptedPayload) return null

  // If payload does not match iv:authTag:cipher format, return as-is (unencrypted legacy data)
  const parts = encryptedPayload.split(":")
  if (parts.length !== 3) {
    return encryptedPayload
  }

  try {
    const key = getEncryptionKey()
    const [ivHex, authTagHex, encryptedText] = parts

    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)

    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedText, "hex", "utf8")
    decrypted += decipher.final("utf8")

    return decrypted
  } catch (error) {
    console.error("[crypto-phi] Decryption error:", error)
    return "[Encrypted PHI - Unable to decrypt]"
  }
}
