import type { ProductRepository } from "./catalog";
import { CatalogIndex } from "./catalog-index";

/** Loads the catalogue from a repository and caches the built index for `ttlMs`. */
export class CatalogService {
  private cached: { index: CatalogIndex; at: number } | undefined;
  private loading: Promise<CatalogIndex> | undefined;

  constructor(
    private readonly repo: ProductRepository,
    private readonly ttlMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  async get(): Promise<CatalogIndex> {
    if (this.cached && this.now() - this.cached.at < this.ttlMs) return this.cached.index;
    this.loading ??= this.repo
      .loadCatalog()
      .then((products) => {
        const index = new CatalogIndex(products);
        this.cached = { index, at: this.now() };
        return index;
      })
      .finally(() => {
        this.loading = undefined;
      });
    return this.loading;
  }

  invalidate(): void {
    this.cached = undefined;
  }
}
