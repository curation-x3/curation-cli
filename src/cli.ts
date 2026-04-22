#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { setPretty, outputError } from "./output.js";
import { maybeAutoUpdate } from "./auto_update.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "package.json"), "utf-8")
    );
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const version = getVersion();

const program = new Command()
  .name("curation")
  .description("Curation CLI — 命令行读你的每日精选卡片")
  .version(version, "-V, --version")
  .option("--pretty", "启用彩色/表格/markdown 渲染（默认 JSON 输出）")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.pretty) setPretty(true);
  });

// ─── auth login ─────────────────────────────────────────────
const auth = program.command("auth").description("认证管理");

auth
  .command("login")
  .description("通过浏览器完成 Authing 登录，token 存 Keychain")
  .action(async () => {
    try {
      setPretty(true); // login is always interactive
      const { loginFlow } = await import("./auth/login.js");
      const result = await loginFlow();

      const pc = (await import("picocolors")).default;
      console.log(`\n┌  ${pc.bold("Curation CLI")}`);
      console.log("│");
      console.log(`◇  ${pc.green("认证成功")}`);
      console.log("│");
      console.log(
        `└  已登录为 ${pc.cyan(result.user.username)} <${result.user.email || result.user.user_id}>\n`
      );
    } catch (err) {
      outputError(err);
    }
  });

// ─── auth logout ────────────────────────────────────────────
auth
  .command("logout")
  .description("清除本地 token")
  .action(async () => {
    try {
      const { logoutFlow } = await import("./auth/logout.js");
      await logoutFlow();
      console.log("\n┌  已登出\n└  本地 token 已清除\n");
    } catch (err) {
      outputError(err);
    }
  });

// ─── status ─────────────────────────────────────────────────
program
  .command("status")
  .description("展示登录状态、版本、token 过期时间等")
  .action(async () => {
    try {
      setPretty(true); // status is always human-readable
      const { statusCommand } = await import("./commands/status.js");
      await statusCommand();
    } catch (err) {
      outputError(err);
    }
  });

// ─── card list ──────────────────────────────────────────────
const card = program.command("card").description("卡片操作");

card
  .command("list")
  .description("列出 inbox 卡片（需指定时间范围）")
  .option("--range <range>", "today | yesterday | this-week | last-week | earlier")
  .option("--since <date>", "起始日期 YYYY-MM-DD")
  .option("--until <date>", "结束日期 YYYY-MM-DD")
  .option("--page <n>", "页码", parseInt)
  .option("--unread", "仅未读（agent）")
  .option("--unread-by-app", "仅 app 未读")
  .option("--starred", "仅收藏")
  .action(async (opts) => {
    try {
      const { cardListCommand } = await import("./commands/card_list.js");
      await cardListCommand({
        range: opts.range,
        since: opts.since,
        until: opts.until,
        page: opts.page,
        unread: opts.unread,
        unreadByApp: opts.unreadByApp,
        starred: opts.starred,
      });
    } catch (err) {
      outputError(err);
    }
  });

// ─── card show ──────────────────────────────────────────────
card
  .command("show <card_id>")
  .description("查看单张卡片详情（正文 + 原文）")
  .action(async (cardId: string) => {
    try {
      const { cardShowCommand } = await import("./commands/card_show.js");
      await cardShowCommand(cardId);
    } catch (err) {
      outputError(err);
    }
  });

// ─── self-update ────────────────────────────────────────────
program
  .command("self-update")
  .description("立即升级 CLI 到 GitHub 最新 tag")
  .action(async () => {
    try {
      const { selfUpdateCommand } = await import("./commands/self_update.js");
      await selfUpdateCommand();
    } catch (err) {
      outputError(err);
    }
  });

// ─── help (explicit command) ────────────────────────────────
program
  .command("help [command...]")
  .description("查看帮助")
  .action((args: string[]) => {
    if (args.length === 0) {
      program.help();
    } else {
      // Find the subcommand and show its help
      let cmd: Command = program;
      for (const name of args) {
        const sub = cmd.commands.find(
          (c) => c.name() === name || c.aliases().includes(name)
        );
        if (sub) {
          cmd = sub;
        } else {
          process.stderr.write(`Unknown command: ${args.join(" ")}\n`);
          process.exit(2);
        }
      }
      cmd.help();
    }
  });

// ─── Parse & run ────────────────────────────────────────────
// parseAsync() properly awaits async action handlers (login server, etc.)
await program.parseAsync();

// Background auto-update after main command completes
// (non-blocking, fire and forget)
maybeAutoUpdate(version).catch(() => {});
