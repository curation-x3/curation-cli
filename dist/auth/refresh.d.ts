/**
 * Attempt to refresh access_token using refresh_token.
 * On success, atomically stores new tokens in Keychain.
 * On failure, clears Keychain.
 * Returns the new access_token, or null on failure.
 */
export declare function refreshAccessToken(): Promise<string | null>;
