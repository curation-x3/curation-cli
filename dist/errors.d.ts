/**
 * Exit codes:
 *   0 — success
 *   1 — business error (not found, etc.)
 *   2 — argument / usage error
 *   4 — authentication required
 *   5 — network / server error
 */
export declare class CurationError extends Error {
    code: number;
    errorType: string;
    constructor(message: string, code: number, errorType?: string);
    toJSON(): {
        error: string;
        message: string;
        code: number;
    };
}
export declare function authError(message?: string): CurationError;
export declare function notFoundError(message: string): CurationError;
export declare function usageError(message: string): CurationError;
export declare function serverError(message: string): CurationError;
