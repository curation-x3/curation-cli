import type { StoredUser } from "./user_store.js";
interface LoginResult {
    user: StoredUser;
    accessToken: string;
}
/**
 * Full OIDC Authorization Code + PKCE login flow.
 * 1. Start loopback server
 * 2. Open browser to Authing
 * 3. Receive callback
 * 4. Exchange code for tokens
 * 5. POST id_token to backend /auth/login
 * 6. Store tokens in Keychain + user in config
 */
export declare function loginFlow(): Promise<LoginResult>;
export {};
