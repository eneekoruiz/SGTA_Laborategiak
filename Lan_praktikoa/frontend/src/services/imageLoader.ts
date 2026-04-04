export type SpriteManifest = Record<string, string[]>;

/**
 * Lightweight image loader with cache and graceful source fallback.
 */
export class ImageLoader {
  private cache = new Map<string, Promise<HTMLImageElement | null>>();

  private loadFromUrl(url: string): Promise<HTMLImageElement | null> {
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    const task = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });

    this.cache.set(url, task);
    return task;
  }

  async loadAny(sources: string[]): Promise<HTMLImageElement | null> {
    for (const source of sources) {
      const image = await this.loadFromUrl(source);
      if (image) return image;
    }
    return null;
  }

  async loadManifest(manifest: SpriteManifest): Promise<Record<string, HTMLImageElement>> {
    const entries = Object.entries(manifest);
    const loaded = await Promise.all(
      entries.map(async ([key, sources]) => {
        const image = await this.loadAny(sources);
        return { key, image };
      })
    );

    const result: Record<string, HTMLImageElement> = {};
    for (const item of loaded) {
      if (item.image) result[item.key] = item.image;
    }
    return result;
  }
}
