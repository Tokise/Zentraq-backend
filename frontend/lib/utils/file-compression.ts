/**
 * File compression utilities for images and PDFs
 * Reduces storage costs and improves load times
 */

// Compress image using Canvas API
export async function compressImage(file: File, maxWidth = 1920, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width
        let height = img.height
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        // Create canvas and draw compressed image
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("Canvas not supported"))

        ctx.drawImage(img, 0, 0, width, height)

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error("Failed to compress image"))
          },
          "image/webp",
          quality,
        )
      }
      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

// Get optimal format for file
export function getOptimalFormat(file: File): string {
  // Always use WebP for images (better compression)
  if (file.type.startsWith("image/")) {
    return "image/webp"
  }
  // Keep PDFs as PDF
  if (file.type === "application/pdf") {
    return "application/pdf"
  }
  // Default to original
  return file.type
}

// Format bytes to human readable size
export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return "0 Bytes"
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

// Validate file type
export function isAllowedFileType(file: File): boolean {
  const allowedTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ])
  return allowedTypes.has(file.type)
}

// Validate file size (10MB max)
export function isAllowedFileSize(file: File, maxSizeMB = 10): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  return file.size <= maxSizeBytes
}