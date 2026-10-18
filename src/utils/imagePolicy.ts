// Image upload rules shared with the backend (AGF-S1-17, PO-5): JPEG, PNG or WebP, at most 8 MB.
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** The reason a file can't be uploaded, or null if it is acceptable. */
export function imageFileProblem(file: Pick<File, "type" | "size">): string | null {
    const type = (file.type || "").toLowerCase();
    if (type === "image/heic" || type === "image/heif") {
        return "HEIC photos aren't supported yet. Please upload a JPEG, PNG or WebP image.";
    }
    if (!ALLOWED_IMAGE_TYPES.includes(type)) return "Unsupported image type. Upload a JPEG, PNG or WebP image.";
    if (file.size > MAX_IMAGE_BYTES) return "Image is too large. The maximum size is 8 MB.";
    return null;
}
