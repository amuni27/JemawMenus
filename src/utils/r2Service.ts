/**
 * Upload that adapts to how the backend presigned:
 * - If presigned URL signed "content-type", send Content-Type header.
 * - Otherwise do NOT send it (prevents 403 signature mismatch).
 */
export async function uploadToR2(uploadUrl: string, file: File) {
    const url = new URL(uploadUrl);
    const signedHeaders = (url.searchParams.get("X-Amz-SignedHeaders") || "").toLowerCase();
    const mustSendContentType = signedHeaders.includes("content-type");

    const headers: Record<string, string> = {};
    if (mustSendContentType) {
        headers["Content-Type"] = file.type || "application/octet-stream";
    }

    const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers,
        mode: "cors",
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upload failed (${res.status}): ${text || res.statusText}`);
    }
}