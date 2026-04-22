import { apiFetch } from "../http.js";
import { isPretty, outputJSON } from "../output.js";
import { notFoundError } from "../errors.js";

export async function cardShowCommand(cardId: string): Promise<void> {
  const resp = await apiFetch(`/cli/cards/${encodeURIComponent(cardId)}`);

  if (resp.status === 404) {
    throw notFoundError(`Card not found: ${cardId}`);
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error((body as any).detail || `HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as {
    card_id: string;
    title: string;
    content: string;
    original_url: string | null;
    routing: string;
    account_name: string;
    publish_date: string | null;
    original_title: string;
    read_from_app: boolean;
    favorite: boolean;
  };

  if (!isPretty()) {
    outputJSON(data);
    return;
  }

  const pc = (await import("picocolors")).default;

  console.log(`\n┌  ${pc.bold(data.title)}`);
  console.log("│");

  const parts: string[] = [];
  if (data.account_name) parts.push(data.account_name);
  if (data.publish_date) parts.push(data.publish_date);
  if (parts.length) console.log(`◇  ${pc.dim(parts.join(" · "))}`);
  if (data.original_url) console.log(`│  ${pc.dim(data.original_url)}`);
  if (data.favorite) console.log(`│  ${pc.yellow("★ 已收藏")}`);
  console.log("│");

  try {
    const { marked } = await import("marked");
    const { default: TerminalRenderer } = await import("marked-terminal");
    marked.use(TerminalRenderer() as any);
    const rendered = marked.parse(data.content);
    if (typeof rendered === "string") {
      console.log(rendered);
    }
  } catch {
    console.log(data.content);
  }

  console.log(`└  card_id: ${pc.dim(cardId)}\n`);
}
