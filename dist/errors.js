/**
 * Exit codes:
 *   0 — success
 *   1 — business error (not found, etc.)
 *   2 — argument / usage error
 *   4 — authentication required
 *   5 — network / server error
 */
export class CurationError extends Error {
    code;
    errorType;
    constructor(message, code, errorType = "error") {
        super(message);
        this.name = "CurationError";
        this.code = code;
        this.errorType = errorType;
    }
    toJSON() {
        return { error: this.errorType, message: this.message, code: this.code };
    }
}
export function authError(message = "Not logged in. Run: curation auth login") {
    return new CurationError(message, 4, "auth_required");
}
export function notFoundError(message) {
    return new CurationError(message, 1, "not_found");
}
export function usageError(message) {
    return new CurationError(message, 2, "usage_error");
}
export function serverError(message) {
    return new CurationError(message, 5, "server_error");
}
//# sourceMappingURL=errors.js.map