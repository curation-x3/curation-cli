import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { CONFIG_DIR_NAME } from "../config.js";
function configDir() {
    const dir = join(homedir(), ".config", CONFIG_DIR_NAME);
    mkdirSync(dir, { recursive: true });
    return dir;
}
function userFilePath() {
    return join(configDir(), "user.json");
}
export function readUser() {
    try {
        const raw = readFileSync(userFilePath(), "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function writeUser(user) {
    writeFileSync(userFilePath(), JSON.stringify(user, null, 2) + "\n");
}
export function deleteUser() {
    try {
        unlinkSync(userFilePath());
    }
    catch {
        // Ignore if not found
    }
}
//# sourceMappingURL=user_store.js.map