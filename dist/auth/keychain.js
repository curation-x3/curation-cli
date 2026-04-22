import { KEYCHAIN_SERVICE } from "../config.js";
// @napi-rs/keyring — cross-platform (macOS Keychain / Win CredMan / Linux libsecret)
let keyring = null;
async function getKeyring() {
    if (!keyring) {
        keyring = await import("@napi-rs/keyring");
    }
    return keyring;
}
export async function getToken(key) {
    try {
        const kr = await getKeyring();
        const entry = new kr.Entry(KEYCHAIN_SERVICE, key);
        return entry.getPassword();
    }
    catch {
        return null;
    }
}
export async function setToken(key, value) {
    const kr = await getKeyring();
    const entry = new kr.Entry(KEYCHAIN_SERVICE, key);
    entry.setPassword(value);
}
export async function deleteToken(key) {
    try {
        const kr = await getKeyring();
        const entry = new kr.Entry(KEYCHAIN_SERVICE, key);
        entry.deletePassword();
    }
    catch {
        // Ignore if not found
    }
}
export async function clearAll() {
    await deleteToken("access_token");
    await deleteToken("refresh_token");
}
//# sourceMappingURL=keychain.js.map