import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isPretty, outputJSON } from "../output.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getCliVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8")
    );
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

async function getLatestTag(): Promise<string | null> {
  try {
    const resp = await fetch(
      "https://api.github.com/repos/aiyah-meloken/curation-cli/releases/latest",
      { headers: { Accept: "application/vnd.github.v3+json" } }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as { tag_name?: string };
    return data.tag_name ?? null;
  } catch {
    return null;
  }
}

export async function selfUpdateCommand(): Promise<void> {
  const currentVersion = getCliVersion();

  if (isPretty()) {
    const pc = (await import("picocolors")).default;
    console.log(`\n┌  ${pc.bold("Self-update")}`);
    console.log(`│  当前版本: v${currentVersion}`);
    console.log("│");
    console.log("◇  正在检查最新版本…");
  }

  const latestTag = await getLatestTag();
  if (!latestTag) {
    const msg = "无法获取最新版本信息";
    if (isPretty()) {
      console.log(`│  ${msg}`);
      console.log("└\n");
    } else {
      outputJSON({ status: "error", message: msg, current_version: currentVersion });
    }
    process.exit(1);
  }

  const latestVersion = latestTag.replace(/^v/, "");
  if (latestVersion === currentVersion) {
    if (isPretty()) {
      const pc = (await import("picocolors")).default;
      console.log(`│  ${pc.green("已是最新版本")}`);
      console.log("└\n");
    } else {
      outputJSON({
        status: "current",
        current_version: currentVersion,
        latest_version: latestVersion,
      });
    }
    return;
  }

  if (isPretty()) {
    console.log(`│  发现新版本: ${latestTag}`);
    console.log("◇  正在升级…");
  }

  try {
    execSync(
      `npm install -g github:aiyah-meloken/curation-cli#${latestTag}`,
      { stdio: isPretty() ? "inherit" : "pipe", timeout: 120_000 }
    );

    if (isPretty()) {
      const pc = (await import("picocolors")).default;
      console.log(`│  ${pc.green(`升级成功: v${currentVersion} → ${latestTag}`)}`);
      console.log("└\n");
    } else {
      outputJSON({
        status: "updated",
        previous_version: currentVersion,
        current_version: latestVersion,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isPretty()) {
      const pc = (await import("picocolors")).default;
      console.log(`│  ${pc.red("升级失败")}: ${msg}`);
      console.log(`│  手动升级: sudo npm i -g github:aiyah-meloken/curation-cli`);
      console.log("└\n");
    } else {
      outputJSON({
        status: "error",
        message: msg,
        current_version: currentVersion,
        latest_version: latestVersion,
      });
    }
    process.exit(1);
  }
}
