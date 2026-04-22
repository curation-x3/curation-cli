import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { CONFIG_DIR_NAME } from "./config.js";
function cacheDir() {
    const dir = join(homedir(), ".config", CONFIG_DIR_NAME);
    mkdirSync(dir, { recursive: true });
    return dir;
}
function cachePath() {
    return join(cacheDir(), "last-update-check.json");
}
export function readUpdateCache() {
    try {
        return JSON.parse(readFileSync(cachePath(), "utf-8"));
    }
    catch {
        return null;
    }
}
function writeUpdateCache(cache) {
    writeFileSync(cachePath(), JSON.stringify(cache, null, 2) + "\n");
}
/**
 * Background auto-update check. Called after main command completes.
 * Non-blocking, all errors silenced.
 */
export async function maybeAutoUpdate(currentVersion) {
    // Check env disable
    if (process.env.CURATION_AUTO_UPDATE === "0")
        return;
    const cache = readUpdateCache();
    // Throttle: once per 24 hours
    if (cache?.checked_at) {
        const elapsed = Date.now() - new Date(cache.checked_at).getTime();
        if (elapsed < 24 * 60 * 60 * 1000 && cache.status === "current")
            return;
    }
    // Check if previously installed version matches latest → mark current
    if (cache?.status === "installing" && cache.latest_tag) {
        const expected = cache.latest_tag.replace(/^v/, "");
        if (currentVersion === expected) {
            writeUpdateCache({
                checked_at: new Date().toISOString(),
                latest_tag: cache.latest_tag,
                status: "current",
            });
            return;
        }
    }
    try {
        const resp = await fetch("https://api.github.com/repos/aiyah-meloken/curation-cli/releases/latest", {
            headers: { Accept: "application/vnd.github.v3+json" },
            signal: AbortSignal.timeout(10_000),
        });
        if (!resp.ok) {
            writeUpdateCache({
                checked_at: new Date().toISOString(),
                latest_tag: null,
                status: "current",
            });
            return;
        }
        const data = (await resp.json());
        const latestTag = data.tag_name;
        if (!latestTag)
            return;
        const latestVersion = latestTag.replace(/^v/, "");
        if (latestVersion === currentVersion) {
            writeUpdateCache({
                checked_at: new Date().toISOString(),
                latest_tag: latestTag,
                status: "current",
            });
            return;
        }
        // New version available — spawn fully detached background install
        const logPath = join(cacheDir(), "update.log");
        const { openSync, closeSync } = await import("node:fs");
        const logFd = openSync(logPath, "w");
        const child = spawn("npm", ["install", "-g", "--install-links", `github:aiyah-meloken/curation-cli#${latestTag}`], {
            detached: true,
            stdio: ["ignore", logFd, logFd],
        });
        child.unref();
        closeSync(logFd);
        writeUpdateCache({
            checked_at: new Date().toISOString(),
            latest_tag: latestTag,
            status: "installing",
            fail_count: 0,
        });
    }
    catch {
        // Silently ignore all errors
    }
}
//# sourceMappingURL=auto_update.js.map