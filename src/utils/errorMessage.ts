// Readable message for a failed API call (AGF-S1-11): the backend's sanitized `message` (AGF-S1-10),
// a connection hint for network failures, otherwise the given fallback. Never Axios' generic text.
type ApiFailure = { response?: { data?: { message?: unknown } }; code?: string; message?: string };

export function errorMessage(err: unknown, fallback: string): string {
    const failure = (err ?? {}) as ApiFailure;
    const serverMessage = failure.response?.data?.message;
    if (typeof serverMessage === "string" && serverMessage.trim()) return serverMessage;
    if (!failure.response && (failure.code === "ERR_NETWORK" || failure.message === "Network Error")) {
        return "Could not reach the server. Check your connection and try again.";
    }
    return fallback;
}
