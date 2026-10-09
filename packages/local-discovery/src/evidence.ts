import type { InventoryEvidenceProvider, InventorySignal, Place, WebSearchProvider } from "@veylo/core";

export interface WebEvidenceOptions {
  webSearch?: WebSearchProvider;
}

function extractDomain(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export class WebEvidenceProvider implements InventoryEvidenceProvider {
  readonly name = "Web Evidence Provider";
  private readonly webSearch?: WebSearchProvider;

  constructor(options: WebEvidenceOptions = {}) {
    this.webSearch = options.webSearch;
  }

  async lookup(req: { place: Place; product: string }): Promise<InventorySignal[]> {
    if (!this.webSearch) {
      return [];
    }

    try {
      const query = `"${req.place.name}" "${req.product}"`;
      const searchRes = await this.webSearch.search(query, 5);
      if (!searchRes || searchRes.length === 0) {
        return [];
      }

      const storeDomain = extractDomain(req.place.website);
      const signals: InventorySignal[] = [];
      const timestamp = new Date().toISOString();

      for (const item of searchRes) {
        const itemDomain = extractDomain(item.url);
        const isFirstParty = Boolean(storeDomain && itemDomain && (itemDomain === storeDomain || itemDomain.endsWith(`.${storeDomain}`)));

        if (isFirstParty) {
          signals.push({
            kind: "product_listed",
            source: req.place.website ?? item.url,
            sourceType: "web",
            timestamp,
            confidence: 0.75,
            firstParty: true,
            summary: `Product listed on store website: "${item.title}"`,
            url: item.url,
          });
        } else {
          signals.push({
            kind: "product_mentioned",
            source: item.url,
            sourceType: "web",
            timestamp,
            confidence: 0.45,
            firstParty: false,
            summary: `Web search mentions ${req.place.name} and ${req.product}: "${item.title}"`,
            url: item.url,
          });
        }
      }

      return signals;
    } catch {
      // Never crash on web search errors; return empty signals so trust evaluation remains honest
      return [];
    }
  }
}
