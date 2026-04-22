interface FetchOptions extends RequestInit {
    noAuth?: boolean;
}
/**
 * Authenticated fetch wrapper.
 * - Auto-attaches Bearer token
 * - On 401: attempts token refresh + single retry
 * - Throws CurationError for auth and server failures
 */
export declare function apiFetch(path: string, options?: FetchOptions): Promise<Response>;
export {};
