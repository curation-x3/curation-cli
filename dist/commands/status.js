import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getToken } from "../auth/keychain.js";
import { readUser } from "../auth/user_store.js";
import { isPretty, outputJSON } from "../output.js";
import { readUpdateCache } from "../auto_update.js";
import { versionGreater } from "../version_compare.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
function getCliVersion() {
    try {
        const pkg = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8"));
        return pkg.version || "unknown";
    }
    catch {
        return "unknown";
    }
}
function decodeJwtPayload(token) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3)
            return null;
        const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
        return JSON.parse(payload);
    }
    catch {
        return null;
    }
}
function formatTimeRemaining(expiresAt) {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    if (diff <= 0)
        return "已过期";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0)
        return `还剩 ${days} 天 ${hours} 小时`;
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `还剩 ${hours} 小时 ${mins} 分钟`;
}
export async function statusCommand() {
    const cliVersion = getCliVersion();
    const user = readUser();
    const accessToken = await getToken("access_token");
    const updateCache = readUpdateCache();
    let accessTokenExpiresAt = null;
    if (accessToken) {
        const payload = decodeJwtPayload(accessToken);
        if (payload?.exp) {
            accessTokenExpiresAt = new Date(payload.exp * 1000).toISOString();
        }
    }
    const latestVersion = updateCache?.latest_tag?.replace(/^v/, "") ?? null;
    const updateAvailable = latestVersion != null && versionGreater(latestVersion, cliVersion);
    const data = {
        cli_version: cliVersion,
        latest_version: latestVersion,
        update_available: updateAvailable,
        authenticated: !!accessToken,
        user: user
            ? {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
            }
            : null,
        access_token_expires_at: accessTokenExpiresAt,
    };
    if (!isPretty()) {
        outputJSON(data);
        return;
    }
    // Pretty output with clack-style framing
    const pc = (await import("picocolors")).default;
    const versionLine = updateAvailable
        ? `Curation CLI v${cliVersion}  ${pc.green(`✨ v${latestVersion} 可用`)}`
        : `Curation CLI v${cliVersion}`;
    console.log(`\n┌  ${pc.bold(versionLine)}`);
    console.log("│");
    if (user && accessToken) {
        console.log(`◇  已登录为 ${pc.cyan(user.username)}`);
    }
    else {
        console.log(`◇  ${pc.yellow("未登录")}`);
        console.log("│   跑 `curation auth login` 开始使用");
    }
    console.log("│");
    console.log("└\n");
}
//# sourceMappingURL=status.js.map