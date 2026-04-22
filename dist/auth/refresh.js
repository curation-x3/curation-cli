import { AUTHING_DOMAIN, AUTHING_APP_ID } from "../config.js";
import { getToken, setToken, clearAll } from "./keychain.js";
/**
 * Attempt to refresh access_token using refresh_token.
 * On success, atomically stores new tokens in Keychain.
 * On failure, clears Keychain.
 * Returns the new access_token, or null on failure.
 */
export async function refreshAccessToken() {
    const refreshToken = await getToken("refresh_token");
    if (!refreshToken)
        return null;
    try {
        const resp = await fetch(`${AUTHING_DOMAIN}/oidc/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: AUTHING_APP_ID,
            }),
        });
        if (!resp.ok) {
            await clearAll();
            return null;
        }
        const data = (await resp.json());
        if (!data.access_token || !data.refresh_token) {
            await clearAll();
            return null;
        }
        // Atomic store: both tokens updated together
        await setToken("access_token", data.access_token);
        await setToken("refresh_token", data.refresh_token);
        return data.access_token;
    }
    catch {
        await clearAll();
        return null;
    }
}
//# sourceMappingURL=refresh.js.map