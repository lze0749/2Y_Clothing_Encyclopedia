"use strict";

/*
 * 2Y AI Prompt Encyclopedia
 * Preset Lazy Loader
 * Step 05
 * Version: 1.0.0
 *
 * 官方 60,000 張資料：
 * 不一次下載。
 * Search Hit 指到哪個 chunk，
 * 才下載哪個 chunk。
 */

const PRESET_MANIFEST_URL =
  new URL(
    "../../data/presets/manifest.json",
    import.meta.url
  );

class PresetLoader {
  #registry = null;

  #manifest = null;

  #categoryMap =
    new Map();

  #loadedChunks =
    new Set();

  #inflight =
    new Map();

  #readyPromise =
    null;

  init(registry) {
    if (
      this.#readyPromise
    ) {
      return this.#readyPromise;
    }

    this.#registry =
      registry;

    this.#readyPromise =
      this.#initialize();

    return this.#readyPromise;
  }

  async #initialize() {
    if (
      !this.#registry.ready
    ) {
      await this.#registry
        .init();
    }

    this.#manifest =
      this.#registry
        .manifest;

    (
      this.#manifest
        ?.categories ||
      []
    ).forEach(
      (entry) => {
        this.#categoryMap.set(
          entry.id,
          entry
        );
      }
    );

    return this.status();
  }

  /* ========================================
     Category Lazy Loading
  ======================================== */

  async primeCategories(
    categories,
    options = {}
  ) {
    await this.init(
      this.#registry
    );

    const count =
      Math.max(
        1,
        Number(
          options.chunks
        ) || 1
      );

    const jobs = [];

    (
      Array.isArray(categories)
        ? categories
        : []
    ).forEach(
      (categoryId) => {
        const entry =
          this.#categoryMap.get(
            categoryId
          );

        if (!entry) {
          return;
        }

        /*
         * Step 25 寫入正式資料時，
         * Manifest 會加入 publishedChunks。
         *
         * 現在沒有資料，所以預設 0，
         * 不會亂打 404。
         */
        const published =
          Number(
            entry.publishedChunks
          ) || 0;

        const wanted =
          Math.min(
            published,
            count
          );

        for (
          let number = 1;
          number <= wanted;
          number += 1
        ) {
          jobs.push(
            this.loadCategoryChunk(
              categoryId,
              number
            )
          );
        }
      }
    );

    return Promise.allSettled(
      jobs
    );
  }

  async loadCategoryChunk(
    categoryId,
    chunkNumber
  ) {
    await this.init(
      this.#registry
    );

    const entry =
      this.#categoryMap.get(
        categoryId
      );

    if (!entry) {
      throw new Error(
        `找不到官方分類：${categoryId}`
      );
    }

    const folder =
      new URL(
        entry.path,
        PRESET_MANIFEST_URL
      );

    const fileName =
      `chunk-${String(
        chunkNumber
      ).padStart(
        3,
        "0"
      )}.json`;

    const url =
      new URL(
        fileName,
        folder
      );

    return this.loadChunkUrl(
      url.href
    );
  }

  /* ========================================
     Search Result Lazy Loading
  ======================================== */

  async ensureHits(
    hits
  ) {
    await this.init(
      this.#registry
    );

    const urls =
      new Set();

    (
      Array.isArray(hits)
        ? hits
        : []
    ).forEach(
      (hit) => {
        /*
         * 已經進 Registry 就不用再載。
         */
        if (
          this.#registry
            .getCard(
              hit.id
            )
        ) {
          return;
        }

        if (
          hit.sourceType !==
          "official"
        ) {
          return;
        }

        if (hit.chunk) {
          const url =
            new URL(
              hit.chunk,
              PRESET_MANIFEST_URL
            );

          urls.add(
            url.href
          );

          return;
        }

        if (
          hit.category &&
          hit.chunkNumber
        ) {
          const entry =
            this.#categoryMap.get(
              hit.category
            );

          if (!entry) {
            return;
          }

          const folder =
            new URL(
              entry.path,
              PRESET_MANIFEST_URL
            );

          const fileName =
            `chunk-${String(
              hit.chunkNumber
            ).padStart(
              3,
              "0"
            )}.json`;

          urls.add(
            new URL(
              fileName,
              folder
            ).href
          );
        }
      }
    );

    const result =
      await Promise.allSettled(
        [
          ...urls
        ].map(
          (url) =>
            this.loadChunkUrl(
              url
            )
        )
      );

    return {
      requested:
        urls.size,

      fulfilled:
        result.filter(
          (item) =>
            item.status ===
            "fulfilled"
        ).length,

      rejected:
        result.filter(
          (item) =>
            item.status ===
            "rejected"
        ).length
    };
  }

  /* ========================================
     Chunk
  ======================================== */

  async loadChunkUrl(
    input
  ) {
    const url =
      String(input);

    if (
      this.#loadedChunks.has(
        url
      )
    ) {
      return {
        url,
        cached: true
      };
    }

    if (
      this.#inflight.has(
        url
      )
    ) {
      return this.#inflight
        .get(url);
    }

    const promise =
      this.#fetchChunk(
        url
      );

    this.#inflight.set(
      url,
      promise
    );

    try {
      return await promise;
    } finally {
      this.#inflight.delete(
        url
      );
    }
  }

  async #fetchChunk(
    url
  ) {
    const response =
      await fetch(
        url,
        {
          cache: "default"
        }
      );

    if (!response.ok) {
      throw new Error(
        `官方資料 Chunk 載入失敗：${url} (${response.status})`
      );
    }

    const payload =
      await response.json();

    const cards =
      Array.isArray(
        payload
      )
        ? payload
        : Array.isArray(
            payload.cards
          )
          ? payload.cards
          : [];

    const decorated =
      cards.map(
        (card) => ({
          ...card,

          metadata: {
            ...(card.metadata || {}),

            searchChunk:
              relativeChunkPath(
                url
              )
          }
        })
      );

    const result =
      this.#registry
        .upsertCards(
          decorated,
          "2y.core"
        );

    this.#loadedChunks.add(
      url
    );

    return {
      url,

      cards:
        decorated.length,

      accepted:
        result.accepted
          .length,

      rejected:
        result.rejected
          .length,

      conflicts:
        result.conflicts
          .length
    };
  }

  status() {
    return {
      ready:
        Boolean(
          this.#manifest
        ),

      loadedChunks:
        this.#loadedChunks
          .size,

      loadingChunks:
        this.#inflight
          .size,

      target:
        Number(
          this.#manifest
            ?.targetCount
        ) || 60000
    };
  }
}

function relativeChunkPath(
  absoluteUrl
) {
  const manifest =
    new URL(
      PRESET_MANIFEST_URL
    );

  const target =
    new URL(
      absoluteUrl
    );

  const base =
    manifest.pathname
      .replace(
        /manifest\.json$/,
        ""
      );

  if (
    target.pathname.startsWith(
      base
    )
  ) {
    return (
      "./" +
      target.pathname
        .slice(
          base.length
        )
    );
  }

  return target.href;
}

export const presetLoader =
  new PresetLoader();