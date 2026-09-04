interface Entry {
  value: unknown;
  expires: number;
  tags: Set<string>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

/** TTL cache with tag invalidation. Keys are `${toolName}:${canonicalArgs}`. */
export class ToolCache {
  private entries = new Map<string, Entry>();
  private tagIndex = new Map<string, Set<string>>();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly defaultTtl = 30_000,
    private readonly maxEntries = 500,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get(key: string): { hit: true; value: unknown } | { hit: false } {
    const e = this.entries.get(key);
    if (!e) {
      this.misses++;
      return { hit: false };
    }
    if (e.expires <= this.now()) {
      this.delete(key);
      this.misses++;
      return { hit: false };
    }
    this.hits++;
    return { hit: true, value: e.value };
  }

  set(key: string, value: unknown, opts: { ttl?: number; tags?: string[] } = {}): void {
    if (this.entries.has(key)) this.delete(key);
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.delete(oldest);
    }
    const tags = new Set(opts.tags ?? []);
    this.entries.set(key, { value, expires: this.now() + (opts.ttl ?? this.defaultTtl), tags });
    for (const t of tags) {
      let set = this.tagIndex.get(t);
      if (!set) this.tagIndex.set(t, (set = new Set()));
      set.add(key);
    }
  }

  delete(key: string): void {
    const e = this.entries.get(key);
    if (!e) return;
    this.entries.delete(key);
    for (const t of e.tags) {
      const set = this.tagIndex.get(t);
      set?.delete(key);
      if (set && set.size === 0) this.tagIndex.delete(t);
    }
  }

  /** Drop every entry carrying any of these tags. Returns how many were dropped. */
  invalidate(tags: string[]): number {
    let n = 0;
    for (const t of tags) {
      const keys = this.tagIndex.get(t);
      if (!keys) continue;
      for (const k of [...keys]) {
        this.delete(k);
        n++;
      }
    }
    return n;
  }

  /** Drop every entry whose key starts with `${toolName}:`. */
  invalidateTool(toolName: string): void {
    for (const k of [...this.entries.keys()]) if (k.startsWith(`${toolName}:`)) this.delete(k);
  }

  clear(): void {
    this.entries.clear();
    this.tagIndex.clear();
  }

  stats(): CacheStats {
    return { hits: this.hits, misses: this.misses, size: this.entries.size };
  }
}
