import type { SearchWebInput, SearchWebOutput } from "@veylo/types";
import type { CoreContext } from "./context";
import { VeyloError } from "./errors";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}
export interface WebSearchProvider {
  readonly name: string;
  search(query: string, limit: number): Promise<WebSearchResult[]>;
}

const NOTE =
  "Web results are WEB_FOUND at most: a page can mention a product or store, but it does not show current stock. Confirm with the store.";

const isHttpUrl = (u: string): boolean => {
  try {
    return /^https?:$/.test(new URL(u).protocol);
  } catch {
    return false;
  }
};

export async function searchWeb(ctx: CoreContext, input: SearchWebInput): Promise<SearchWebOutput> {
  if (!ctx.webSearch) {
    throw new VeyloError("NOT_CONFIGURED", "search_web is not configured. Set BRAVE_SEARCH_API_KEY to enable it.");
  }
  const limit = input.limit ?? 5;
  const query = [input.query, input.location].filter(Boolean).join(" ");
  let results: WebSearchResult[];
  try {
    results = await ctx.webSearch.search(query, limit);
  } catch (err) {
    ctx.logger?.warn("web search failed", { provider: ctx.webSearch.name, reason: String(err) });
    throw new VeyloError("UPSTREAM_UNAVAILABLE", `Web search (${ctx.webSearch.name}) is unavailable right now.`);
  }
  const retrievedAt = (ctx.clock?.() ?? new Date()).toISOString();
  return {
    trust: "WEB_FOUND",
    results: results
      .filter((r) => r.title && isHttpUrl(r.url))
      .slice(0, limit)
      .map((r) => ({ title: r.title, url: r.url, snippet: r.snippet, retrievedAt })),
    note: NOTE,
  };
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").trim();

/**
 * Brave Search API adapter. Written from the public API shape (web.results[].title/url/description);
 * not exercised against the live API in this repo's tests, which use an injected fetch.
 */
export class BraveSearchProvider implements WebSearchProvider {
  readonly name = "Brave Search API";
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly endpoint = "https://api.search.brave.com/res/v1/web/search",
  ) {}

  async search(query: string, limit: number): Promise<WebSearchResult[]> {
    const url = new URL(this.endpoint);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(Math.max(limit, 1), 20)));
    const res = await this.fetchFn(url, {
      headers: { Accept: "application/json", "X-Subscription-Token": this.apiKey },
    });
    if (!res.ok) throw new Error(`Brave Search returned HTTP ${res.status}`);
    const body = (await res.json()) as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } };
    return (body.web?.results ?? [])
      .filter((r): r is { title: string; url: string; description?: string } => Boolean(r.title && r.url))
      .map((r) => ({ title: stripTags(r.title), url: r.url, snippet: stripTags(r.description ?? "") }));
  }
}
