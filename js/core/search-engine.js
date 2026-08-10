"use strict";

/*
 * 2Y AI Prompt Encyclopedia
 * Search Engine
 * Step 05
 * Version: 1.0.0
 *
 * 責任：
 * - Search Worker 管理
 * - Runtime Card Incremental Index
 * - Static Prebuilt Index Segment 載入
 * - Search / Facets API
 */

const SEARCH_MANIFEST_URL =
  new URL(
    "../../data/search/manifest.json",
    import.meta.url
  );

const WORKER_URL =
  new URL(
    "../workers/search-worker.js",
    import.meta.url
  );

class SearchEngine {
  #registry = null;

  #worker = null;

  #manifest = null;

  #readyPromise = null;

  #requests =
    new Map();

  #requestSequence =
    0;

  #loadedSegments =
    new Set();

  #segmentPromises =
    new Map();

  #unsubscribeRegistry =
    null;

  async init(registry) {
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
      await loadJson(
        SEARCH_MANIFEST_URL
      );

    this.#worker =
      new Worker(
        WORKER_URL,
        {
          type: "module"
        }
      );

    this.#worker
      .addEventListener(
        "message",
        (event) =>
          this.#handleWorkerMessage(
            event
          )
      );

    this.#worker
      .addEventListener(
        "error",
        (event) => {
          console.error(
            "Search Worker error:",
            event
          );
        }
      );

    await this.#request(
      "INIT"
    );

    await this.#indexExistingRegistry();

    this.#unsubscribeRegistry =
      this.#registry
        .subscribe(
          (message) =>
            this.#handleRegistryMessage(
              message
            )
        );

    return this.status();
  }

  /* ========================================
     Search
  ======================================== */

  async search(
    query,
    options = {}
  ) {
    await this.init(
      this.#registry
    );

    const categories =
      normalizeCategories(
        options.categories
      );

    await this.ensureSegments(
      categories
    );

    const enabledSourceIds =
      this.#registry
        .getSources({
          enabledOnly: true
        })
        .map(
          (source) =>
            source.id
        );

    return this.#request(
      "SEARCH",
      {
        query:
          String(
            query || ""
          ),

        filters: {
          categories,

          sourceType:
            options.sourceType ||
            "all",

          platform:
            options.platform ||
            "all",

          material:
            options.material ===
              "all"
              ? ""
              : options.material ||
                "",

          gender:
            options.gender ===
              "all"
              ? ""
              : options.gender ||
                "",

          enabledSourceIds
        },

        sort:
          options.sort ||
          "default",

        offset:
          options.offset ||
          0,

        limit:
          options.limit ||
          12
      }
    );
  }

  async getFacets(
    options = {}
  ) {
    await this.init(
      this.#registry
    );

    const categories =
      normalizeCategories(
        options.categories
      );

    await this.ensureSegments(
      categories
    );

    const enabledSourceIds =
      this.#registry
        .getSources({
          enabledOnly: true
        })
        .map(
          (source) =>
            source.id
        );

    return this.#request(
      "FACETS",
      {
        categories,
        enabledSourceIds
      }
    );
  }

  /* ========================================
     Static Index Segments
  ======================================== */

  async ensureSegments(
    categories = []
  ) {
    const segments =
      Array.isArray(
        this.#manifest
          ?.segments
      )
        ? this.#manifest
            .segments
        : [];

    if (!segments.length) {
      return {
        loaded:
          this.#loadedSegments
            .size,

        available: 0
      };
    }

    const categorySet =
      new Set(
        categories
      );

    const wanted =
      segments.filter(
        (segment) => {
          if (
            segment.published ===
            false
          ) {
            return false;
          }

          if (
            !categorySet.size
          ) {
            return true;
          }

          const segmentCategories =
            Array.isArray(
              segment.categories
            )
              ? segment.categories
              : [];

          return segmentCategories
            .some(
              (category) =>
                categorySet.has(
                  category
                )
            );
        }
      );

    await Promise.all(
      wanted.map(
        (segment) =>
          this.#loadSegment(
            segment
          )
      )
    );

    return {
      loaded:
        this.#loadedSegments
          .size,

      available:
        segments.length
    };
  }

  async #loadSegment(
    segment
  ) {
    if (
      this.#loadedSegments.has(
        segment.id
      )
    ) {
      return;
    }

    if (
      this.#segmentPromises.has(
        segment.id
      )
    ) {
      return this.#segmentPromises
        .get(
          segment.id
        );
    }

    const promise =
      (async () => {
        const url =
          new URL(
            segment.url,
            SEARCH_MANIFEST_URL
          );

        const payload =
          await loadJson(
            url
          );

        const documents =
          Array.isArray(
            payload
          )
            ? payload
            : Array.isArray(
                payload.documents
              )
              ? payload.documents
              : [];

        if (documents.length) {
          await this.#request(
            "UPSERT_DOCUMENTS",
            {
              documents
            }
          );
        }

        this.#loadedSegments.add(
          segment.id
        );
      })();

    this.#segmentPromises.set(
      segment.id,
      promise
    );

    try {
      await promise;
    } finally {
      this.#segmentPromises.delete(
        segment.id
      );
    }
  }

  /* ========================================
     Runtime Registry Index
  ======================================== */

  async #indexExistingRegistry() {
    const sources =
      this.#registry
        .getSources();

    for (
      const source
      of sources
    ) {
      await this.#syncSource(
        source.id
      );
    }
  }

  async #syncSource(
    sourceId
  ) {
    const cards =
      this.#registry
        .getCards({
          sourceId,
          enabledOnly: false
        });

    const documents =
      cards.map(
        (card) =>
          createSearchDocument(
            card,
            sourceId
          )
      );

    if (!documents.length) {
      return;
    }

    await this.#request(
      "UPSERT_DOCUMENTS",
      {
        documents
      }
    );
  }

  async #handleRegistryMessage(
    message
  ) {
    try {
      if (
        message.type ===
        "cards-updated"
      ) {
        if (
          Array.isArray(
            message.acceptedIds
          )
        ) {
          const documents =
            message.acceptedIds
              .map(
                (id) =>
                  this.#registry
                    .getCard(id)
              )
              .filter(Boolean)
              .map(
                (card) =>
                  createSearchDocument(
                    card,
                    message.sourceId
                  )
              );

          if (documents.length) {
            await this.#request(
              "UPSERT_DOCUMENTS",
              {
                documents
              }
            );
          }

          return;
        }

        /*
         * 舊 Registry 相容 fallback。
         * Step 05 修改後通常不會走到這裡。
         */
        await this.#syncSource(
          message.sourceId
        );

        return;
      }

      if (
        message.type ===
        "card-removed"
      ) {
        await this.#request(
          "REMOVE_IDS",
          {
            ids: [
              message.cardId
            ]
          }
        );

        return;
      }

      if (
        message.type ===
        "source-cards-removed"
      ) {
        if (
          Array.isArray(
            message.removedIds
          )
        ) {
          await this.#request(
            "REMOVE_IDS",
            {
              ids:
                message.removedIds
            }
          );
        } else {
          await this.#request(
            "REMOVE_SOURCE",
            {
              sourceId:
                message.sourceId
            }
          );
        }

        return;
      }

      if (
        message.type ===
        "source-unregistered"
      ) {
        await this.#request(
          "REMOVE_SOURCE",
          {
            sourceId:
              message.sourceId
          }
        );

        return;
      }

      if (
        message.type ===
          "source-status-changed" &&
        message.enabled
      ) {
        await this.#syncSource(
          message.sourceId
        );
      }
    } catch (error) {
      console.error(
        "Search Engine Registry sync error:",
        error
      );
    }
  }

  /* ========================================
     Status
  ======================================== */

  async status() {
    if (!this.#worker) {
      return {
        ready: false,
        loadedSegments: 0,
        availableSegments:
          this.#manifest
            ?.segments
            ?.length ||
          0
      };
    }

    const workerStatus =
      await this.#request(
        "STATUS"
      );

    return {
      ...workerStatus,

      loadedSegments:
        this.#loadedSegments
          .size,

      availableSegments:
        this.#manifest
          ?.segments
          ?.length ||
        0
    };
  }

  destroy() {
    this.#unsubscribeRegistry?.();

    this.#unsubscribeRegistry =
      null;

    this.#worker?.terminate();

    this.#worker = null;

    this.#requests.clear();

    this.#readyPromise =
      null;
  }

  /* ========================================
     Worker RPC
  ======================================== */

  #request(
    type,
    payload = {}
  ) {
    if (!this.#worker) {
      return Promise.reject(
        new Error(
          "Search Worker 尚未初始化。"
        )
      );
    }

    const requestId =
      `search-${Date.now()}-${++this.#requestSequence}`;

    return new Promise(
      (
        resolve,
        reject
      ) => {
        this.#requests.set(
          requestId,
          {
            resolve,
            reject
          }
        );

        this.#worker
          .postMessage({
            requestId,
            type,
            payload
          });
      }
    );
  }

  #handleWorkerMessage(
    event
  ) {
    const {
      requestId,
      ok,
      result,
      error
    } =
      event.data || {};

    const request =
      this.#requests.get(
        requestId
      );

    if (!request) {
      return;
    }

    this.#requests.delete(
      requestId
    );

    if (ok) {
      request.resolve(
        result
      );

      return;
    }

    request.reject(
      new Error(
        error ||
        "Search Worker 未知錯誤。"
      )
    );
  }
}

/* ============================================
   Search Document Builder
============================================ */

function createSearchDocument(
  card,
  sourceId
) {
  const materials =
    collectAttributeLabels(
      card,
      "material"
    );

  const genders =
    collectAttributeLabels(
      card,
      "gender"
    );

  const colors =
    (
      card.colorways ||
      []
    ).flatMap(
      (colorway) => [
        colorway.nameZh,
        colorway.nameEn,

        ...(
          colorway.palette ||
          []
        ).flatMap(
          (color) => [
            color.nameZh,
            color.nameEn
          ]
        )
      ]
    );

  return {
    id:
      card.id,

    category:
      card.category,

    sourceType:
      card.source?.type ||
      "official",

    sourceId:
      sourceId ||
      card.source?.packId ||
      "2y.core",

    chunk:
      card.metadata
        ?.searchChunk ||
      "",

    chunkNumber:
      card.metadata
        ?.chunkNumber ||
      0,

    nameZh:
      card.nameZh,

    nameEn:
      card.nameEn,

    description:
      [
        card.descriptionZh,
        card.descriptionEn
      ]
        .filter(Boolean)
        .join(" "),

    tags:
      card.tags ||
      [],

    materials,

    genders,

    platforms:
      card.platforms ||
      [],

    colors:
      colors.filter(
        Boolean
      ),

    positivePrompt:
      card.prompt
        ?.positive ||
      [],

    negativePrompt:
      card.prompt
        ?.negative ||
      [],

    updatedAt:
      card.metadata
        ?.updatedAt ||
      ""
  };
}

function collectAttributeLabels(
  card,
  attributeId
) {
  return (
    card.attributes?.[
      attributeId
    ] ||
    []
  ).flatMap(
    (option) => [
      option.nameZh,
      option.nameEn
    ]
  ).filter(Boolean);
}

function normalizeCategories(
  value
) {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            Boolean
          )
        )
      ]
    : [];
}

async function loadJson(
  url
) {
  const response =
    await fetch(
      url,
      {
        cache: "no-store"
      }
    );

  if (!response.ok) {
    throw new Error(
      `Search 資料載入失敗：${url.pathname} (${response.status})`
    );
  }

  return response.json();
}

export const searchEngine =
  new SearchEngine();