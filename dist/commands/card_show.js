import { apiFetch } from "../http.js";
import { isPretty, outputJSON } from "../output.js";
import { notFoundError } from "../errors.js";
export async function cardShowCommand(cardId) {
    // Fetch card content
    const resp = await apiFetch(`/cards/${encodeURIComponent(cardId)}/content`);
    if (resp.status === 404) {
        throw notFoundError(`Card not found: ${cardId}`);
    }
    if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${resp.status}`);
    }
    const data = (await resp.json());
    // Mark as read (fire and forget)
    apiFetch(`/cards/${encodeURIComponent(cardId)}/read`, {
        method: "POST",
    }).catch(() => { });
    // Fetch favorites to check star status
    let favorite = false;
    try {
        const favResp = await apiFetch("/favorites");
        const favData = (await favResp.json());
        favorite = favData.items.some((f) => f.item_type === "card" && f.item_id === cardId);
    }
    catch {
        // Ignore
    }
    const result = {
        card_id: data.card_id,
        title: data.title,
        content: data.content,
        original_url: data.article_meta?.url || null,
        tags: [],
        routing: "ai_curation",
        account_name: data.article_meta?.account || "",
        publish_date: data.article_meta?.publish_time?.slice(0, 10) || null,
        original_title: data.article_meta?.title || "",
        read_from_app: true,
        read_by_agent: 1,
        favorite,
    };
    if (!isPretty()) {
        outputJSON(result);
        return;
    }
    // Pretty output: render markdown content
    const pc = (await import("picocolors")).default;
    // Header
    console.log(`\n┌  ${pc.bold(data.title)}`);
    console.log("│");
    if (data.article_meta) {
        const meta = data.article_meta;
        const parts = [];
        if (meta.account)
            parts.push(meta.account);
        if (meta.author && meta.author !== meta.account)
            parts.push(meta.author);
        if (meta.publish_time)
            parts.push(meta.publish_time.slice(0, 10));
        console.log(`◇  ${pc.dim(parts.join(" · "))}`);
        if (meta.url) {
            console.log(`│  ${pc.dim(meta.url)}`);
        }
    }
    if (favorite) {
        console.log(`│  ${pc.yellow("★ 已收藏")}`);
    }
    console.log("│");
    // Render markdown content
    try {
        const { marked } = await import("marked");
        const { default: TerminalRenderer } = await import("marked-terminal");
        marked.use(TerminalRenderer());
        const rendered = marked.parse(data.content);
        if (typeof rendered === "string") {
            console.log(rendered);
        }
    }
    catch {
        // Fallback: plain text
        console.log(data.content);
    }
    console.log(`└  card_id: ${pc.dim(cardId)}\n`);
}
//# sourceMappingURL=card_show.js.map