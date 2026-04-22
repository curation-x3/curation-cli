import { apiFetch } from "../http.js";
import { isPretty, outputJSON } from "../output.js";
import { usageError } from "../errors.js";
import { PAGE_SIZE } from "../config.js";

interface CardListOptions {
  range?: string;
  since?: string;
  until?: string;
  page?: number;
  unread?: boolean;
  unreadByApp?: boolean;
  starred?: boolean;
}

interface InboxItem {
  card_id: string | null;
  article_id: string;
  title: string;
  description: string | null;
  routing: string | null;
  article_date: string | null;
  read_at: string | null;
  queue_status: string | null;
  article_meta: {
    title: string;
    account: string;
    account_id: number | null;
    author: string | null;
    publish_time: string | null;
    url: string;
  };
}

interface FavoriteItem {
  item_type: string;
  item_id: string;
}

function getDateRange(
  range: string
): { since: string; until: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

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
      throw usageError(
        `Invalid range: "${range}". Valid: today, yesterday, this-week, last-week, earlier`
      );
  }
}

function dateInRange(
  dateStr: string | null,
  since: string,
  until: string
): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= since && d <= until;
}

export async function cardListCommand(opts: CardListOptions): Promise<void> {
  // Validate: must have range or since+until
  if (!opts.range && (!opts.since || !opts.until)) {
    throw usageError(
      "Must specify --range or both --since and --until. See: curation help card list"
    );
  }
  if (opts.range && (opts.since || opts.until)) {
    throw usageError("Cannot use --range with --since/--until");
  }

  let since: string;
  let until: string;
  if (opts.range) {
    const r = getDateRange(opts.range);
    since = r.since;
    until = r.until;
  } else {
    since = opts.since!;
    until = opts.until!;
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    throw usageError("Dates must be in YYYY-MM-DD format");
  }

  const page = opts.page ?? 1;
  if (page < 1) throw usageError("Page must be >= 1");

  // Fetch inbox (unread_only filter is server-side)
  const params = new URLSearchParams();
  if (opts.unreadByApp) {
    params.set("unread_only", "true");
  }

  const resp = await apiFetch(`/inbox?${params.toString()}`);
  const data = (await resp.json()) as { items: InboxItem[] };
  let items = data.items.filter((i) => i.card_id != null); // Skip analyzing

  // Filter by date range
  items = items.filter((i) => dateInRange(i.article_date, since, until));

  // Filter unread by app
  if (opts.unreadByApp) {
    items = items.filter((i) => !i.read_at);
  }

  // Filter unread (by agent — not tracked yet, use app read_at as proxy)
  if (opts.unread) {
    items = items.filter((i) => !i.read_at);
  }

  // Filter starred
  let favoriteIds: Set<string> | null = null;
  if (opts.starred) {
    const favResp = await apiFetch("/favorites");
    const favData = (await favResp.json()) as { items: FavoriteItem[] };
    favoriteIds = new Set(
      favData.items
        .filter((f) => f.item_type === "card")
        .map((f) => f.item_id)
    );
    items = items.filter((i) => i.card_id && favoriteIds!.has(i.card_id));
  }

  // Pagination
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  if (page > totalPages && totalCount > 0) {
    throw usageError(`Page ${page} exceeds total pages (${totalPages})`);
  }

  const startIdx = (page - 1) * PAGE_SIZE;
  const pageItems = items.slice(startIdx, startIdx + PAGE_SIZE);

  // Fetch favorites if not already done (for the starred column)
  if (!favoriteIds) {
    try {
      const favResp = await apiFetch("/favorites");
      const favData = (await favResp.json()) as { items: FavoriteItem[] };
      favoriteIds = new Set(
        favData.items
          .filter((f) => f.item_type === "card")
          .map((f) => f.item_id)
      );
    } catch {
      favoriteIds = new Set();
    }
  }

  // Build output
  const outputItems = pageItems.map((item) => ({
    card_id: item.card_id,
    title: item.title,
    summary: item.description,
    tags: [],
    routing: item.routing || "ai_curation",
    account_name: item.article_meta?.account || "",
    publish_date: item.article_date,
    original_title: item.article_meta?.title || "",
    read_from_app: !!item.read_at,
    read_by_agent: 0,
    favorite: item.card_id ? favoriteIds!.has(item.card_id) : false,
  }));

  const result = {
    data: outputItems,
    page,
    total_pages: totalPages,
    total_count: totalCount,
  };

  if (!isPretty()) {
    outputJSON(result);
    return;
  }

  // Pretty table output
  const pc = (await import("picocolors")).default;
  const Table = (await import("cli-table3")).default;

  console.log(
    `\n${pc.bold("Inbox")} — ${since} ~ ${until}  (${totalCount} 条, 第 ${page}/${totalPages} 页)\n`
  );

  if (outputItems.length === 0) {
    console.log(pc.dim("  没有卡片\n"));
    return;
  }

  const table = new Table({
    head: ["", "标题", "来源", "日期", "路由"].map((h) => pc.bold(h)),
    colWidths: [5, 40, 14, 12, 14],
    wordWrap: true,
    style: { head: [], border: [] },
  });

  for (const item of outputItems) {
    // Status icons: ★ = starred, ● = unread, ○ = read
    const star = item.favorite ? pc.yellow("★") : " ";
    const read = item.read_from_app ? pc.dim("○") : pc.green("●");
    const status = `${star}${read}`;

    const routing =
      item.routing === "original_push"
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
