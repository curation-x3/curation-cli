import { apiFetch } from "../http.js";
import { isPretty, outputJSON } from "../output.js";
import { usageError } from "../errors.js";
function getDateRange(range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fmt = (d) => d.toISOString().slice(0, 10);
    switch (range) {
        case "today":
            return { since: fmt(today), until: fmt(today) };
        case "yesterday": {
            const y = new Date(today);
            y.setDate(y.getDate() - 1);
            return { since: fmt(y), until: fmt(y) };
        }
        case "this-week": {
            const day = today.getDay();
            const mon = new Date(today);
            mon.setDate(mon.getDate() - (day === 0 ? 6 : day - 1));
            return { since: fmt(mon), until: fmt(today) };
        }
        case "last-week": {
            const day = today.getDay();
            const thisMon = new Date(today);
            thisMon.setDate(thisMon.getDate() - (day === 0 ? 6 : day - 1));
            const lastMon = new Date(thisMon);
            lastMon.setDate(lastMon.getDate() - 7);
            const lastSun = new Date(thisMon);
            lastSun.setDate(lastSun.getDate() - 1);
            return { since: fmt(lastMon), until: fmt(lastSun) };
        }
        case "earlier": {
            const day = today.getDay();
            const thisMon = new Date(today);
            thisMon.setDate(thisMon.getDate() - (day === 0 ? 6 : day - 1));
            const lastMon = new Date(thisMon);
            lastMon.setDate(lastMon.getDate() - 7);
            const beforeLast = new Date(lastMon);
            beforeLast.setDate(beforeLast.getDate() - 1);
            return { since: "2020-01-01", until: fmt(beforeLast) };
        }
        default:
            throw usageError(`Invalid range: "${range}". Valid: today, yesterday, this-week, last-week, earlier`);
    }
}
export async function cardListCommand(opts) {
    if (!opts.range && (!opts.since || !opts.until)) {
        throw usageError("Must specify --range or both --since and --until. See: curation help card list");
    }
    if (opts.range && (opts.since || opts.until)) {
        throw usageError("Cannot use --range with --since/--until");
    }
    let since;
    let until;
    if (opts.range) {
        const r = getDateRange(opts.range);
        since = r.since;
        until = r.until;
    }
    else {
        since = opts.since;
        until = opts.until;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
        throw usageError("Dates must be in YYYY-MM-DD format");
    }
    const page = opts.page ?? 1;
    if (page < 1)
        throw usageError("Page must be >= 1");
    // All filtering + pagination done server-side
    const params = new URLSearchParams({ since, until, page: String(page) });
    if (opts.unread)
        params.set("unread", "true");
    if (opts.starred)
        params.set("starred", "true");
    const resp = await apiFetch(`/cli/cards?${params.toString()}`);
    if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${resp.status}`);
    }
    const result = (await resp.json());
    if (!isPretty()) {
        outputJSON(result);
        return;
    }
    const pc = (await import("picocolors")).default;
    const Table = (await import("cli-table3")).default;
    console.log(`\n${pc.bold("Inbox")} — ${since} ~ ${until}  (${result.total_count} 条, 第 ${result.page}/${result.total_pages} 页)\n`);
    if (result.data.length === 0) {
        console.log(pc.dim("  没有卡片\n"));
        return;
    }
    const table = new Table({
        head: ["", "标题", "来源", "日期", "路由"].map((h) => pc.bold(h)),
        colWidths: [5, 40, 14, 12, 14],
        wordWrap: true,
        style: { head: [], border: [] },
    });
    for (const item of result.data) {
        const star = item.favorite ? pc.yellow("★") : " ";
        const read = item.read_from_app ? pc.dim("○") : pc.green("●");
        const status = `${star}${read}`;
        const routing = item.routing === "original_push"
            ? pc.blue("原文推送")
            : pc.green("AI梳理");
        table.push([
            status,
            item.title || pc.dim("(无标题)"),
            item.account_name || pc.dim("-"),
            item.publish_date || "-",
            routing,
        ]);
    }
    console.log(table.toString());
    console.log();
}
//# sourceMappingURL=card_list.js.map