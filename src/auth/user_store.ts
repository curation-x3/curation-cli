import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { CONFIG_DIR_NAME } from "../config.js";

export interface StoredUser {
  user_id: number;
  username: string;
  email: string | null;
  role: string;
}

function configDir(): string {
  const dir = join(homedir(), ".config", CONFIG_DIR_NAME);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function userFilePath(): string {
  return join(configDir(), "user.json");
}

export function readUser(): StoredUser | null {
  try {
    const raw = readFileSync(userFilePath(), "utf-8");
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function writeUser(user: StoredUser): void {
  writeFileSync(userFilePath(), JSON.stringify(user, null, 2) + "\n");
}

export function deleteUser(): void {
  try {
    unlinkSync(userFilePath());
  } catch {
    // Ignore if not found
  }
}
