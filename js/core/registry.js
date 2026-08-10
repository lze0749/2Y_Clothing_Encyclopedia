"use strict";

/*
 * 2Y AI Prompt Encyclopedia
 * Data Registry
 * Version: 1.0.0
 *
 * 鐵律：
 * - Registry 不管理 DOM
 * - Registry 不使用 MutationObserver
 * - Registry 不使用 window CustomEvent 自我廣播
 * - Registry 不允許不同來源使用相同 Card ID
 * - official / custom / external 永久分離
 */

const SOURCE_TYPES = Object.freeze([
  "official",
  "custom",
  "external"
]);

const PLATFORM_IDS = Object.freeze([
  "pixai",
  "niji",
  "tensorart",
  "gpt-image"
]);

const DATA_URLS = Object.freeze({
  taxonomy: new URL(
    "../../data/taxonomy.json",
    import.meta.url
  ),

  manifest: new URL(
    "../../data/presets/manifest.json",
    import.meta.url
  ),

  schema: new URL(
    "../../data/schema/card.schema.json",
    import.meta.url
  )
});

class DataRegistry {
  #ready = false;

  #cards = new Map();

  #sources = new Map();

  #subscribers = new Set();

  #conflicts = [];

  #taxonomy = null;

  #manifest = null;

  #schema = null;

  #categoryById = new Map();

  #categoryLookup = new Map();

  async init() {
    if (this.#ready) {
      return this.snapshot();
    }

    const [
      taxonomy,
      manifest,
      schema
    ] = await Promise.all([
      loadJson(DATA_URLS.taxonomy),
      loadJson(DATA_URLS.manifest),
      loadJson(DATA_URLS.schema)
    ]);

    this.#taxonomy = taxonomy;
    this.#manifest = manifest;
    this.#schema = schema;

    this.#buildCategoryIndexes();

    this.registerSource({
      id: "2y.core",
      type: "official",
      packId: "2y.core",
      version:
        manifest?.pack?.version ||
        "1.0.0",
      label: "2Y Official Preset Database",
      enabled: true,
      system: true
    });

    this.registerSource({
      id: "2y.custom",
      type: "custom",
      packId: "2y.custom",
      version: "1.0.0",
      label: "Local Custom Cards",
      enabled: true,
      system: true
    });

    this.#ready = true;

    this.#notify({
      type: "registry-ready"
    });

    return this.snapshot();
  }

  get ready() {
    return this.#ready;
  }

  get taxonomy() {
    return clone(this.#taxonomy);
  }

  get manifest() {
    return clone(this.#manifest);
  }

  get schema() {
    return clone(this.#schema);
  }

  registerSource(source) {
    const normalized =
      normalizeSource(source);

    const existing =
      this.#sources.get(
        normalized.id
      );

    if (existing) {
      this.#sources.set(
        normalized.id,
        {
          ...existing,
          ...normalized,
          cardCount:
            existing.cardCount || 0
        }
      );
    } else {
      this.#sources.set(
        normalized.id,
        {
          ...normalized,
          cardCount: 0
        }
      );
    }

    this.#notify({
      type: "source-registered",
      sourceId: normalized.id
    });

    return this.getSource(
      normalized.id
    );
  }

  unregisterSource(sourceId) {
    const source =
      this.#sources.get(sourceId);

    if (!source) {
      return false;
    }

    if (source.system) {
      throw new Error(
        `系統資料來源不可移除：${sourceId}`
      );
    }

    this.removeCardsBySource(
      sourceId
    );

    this.#sources.delete(
      sourceId
    );

    this.#notify({
      type: "source-unregistered",
      sourceId
    });

    return true;
  }

  setSourceEnabled(
    sourceId,
    enabled
  ) {
    const source =
      this.#sources.get(sourceId);

    if (!source) {
      throw new Error(
        `找不到資料來源：${sourceId}`
      );
    }

    source.enabled =
      Boolean(enabled);

    this.#notify({
      type: "source-status-changed",
      sourceId,
      enabled: source.enabled
    });

    return clone(source);
  }

  getSource(sourceId) {
    const source =
      this.#sources.get(sourceId);

    return source
      ? clone(source)
      : null;
  }

  getSources(options = {}) {
    const {
      type = "",
      enabledOnly = false
    } = options;

    return [
      ...this.#sources.values()
    ]
      .filter((source) => {
        if (
          type &&
          source.type !== type
        ) {
          return false;
        }

        if (
          enabledOnly &&
          !source.enabled
        ) {
          return false;
        }

        return true;
      })
      .map(clone);
  }

  upsertCards(
    cards,
    sourceId
  ) {
    if (!Array.isArray(cards)) {
      throw new TypeError(
        "upsertCards() 需要卡片陣列。"
      );
    }

    const source =
      this.#sources.get(sourceId);

    if (!source) {
      throw new Error(
        `尚未註冊資料來源：${sourceId}`
      );
    }

    const result = {
      sourceId,
      accepted: [],
      rejected: [],
      conflicts: []
    };

    for (
      let index = 0;
      index < cards.length;
      index += 1
    ) {
      const rawCard =
        cards[index];

      const normalized =
        this.#normalizeCard(
          rawCard,
          source
        );

      const validation =
        this.validateCard(
          normalized
        );

      if (!validation.valid) {
        result.rejected.push({
          index,
          id:
            normalized?.id ||
            "",
          errors:
            validation.errors
        });

        continue;
      }

      const existing =
        this.#cards.get(
          normalized.id
        );

      if (
        existing &&
        existing.__registry.sourceId !==
          sourceId
      ) {
        const conflict = {
          cardId:
            normalized.id,

          existingSource:
            existing.__registry.sourceId,

          incomingSource:
            sourceId
        };

        this.#conflicts.push(
          conflict
        );

        result.conflicts.push(
          conflict
        );

        continue;
      }

      this.#cards.set(
        normalized.id,
        normalized
      );

      result.accepted.push(
        normalized.id
      );
    }

    this.#updateSourceCount(
      sourceId
    );

    if (
      result.accepted.length ||
      result.rejected.length ||
      result.conflicts.length
    ) {
      this.#notify({
        type: "cards-updated",
        sourceId,

        accepted:
          result.accepted.length,

        acceptedIds:
          [...result.accepted],

        rejected:
          result.rejected.length,

        conflicts:
          result.conflicts.length
      });
    }

    return clone(result);
  }

  removeCard(
    cardId,
    options = {}
  ) {
    const card =
      this.#cards.get(cardId);

    if (!card) {
      return false;
    }

    const source =
      this.#sources.get(
        card.__registry.sourceId
      );

    if (
      source?.type === "official" &&
      !options.allowOfficial
    ) {
      throw new Error(
        "官方預設資料卡不可由一般操作刪除。"
      );
    }

    this.#cards.delete(
      cardId
    );

    this.#updateSourceCount(
      card.__registry.sourceId
    );

    this.#notify({
      type: "card-removed",
      cardId
    });

    return true;
  }

  removeCardsBySource(
    sourceId
  ) {
    let removed = 0;

    const removedIds = [];

    for (
      const [
        cardId,
        card
      ] of this.#cards.entries()
    ) {
      if (
        card.__registry.sourceId ===
        sourceId
      ) {
        this.#cards.delete(
          cardId
        );

        removedIds.push(
          cardId
        );

        removed += 1;
      }
    }

    this.#updateSourceCount(
      sourceId
    );

    if (removed) {
      this.#notify({
        type: "source-cards-removed",
        sourceId,
        removed,
        removedIds
      });
    }

    return removed;
  }

  getCard(cardId) {
    const card =
      this.#cards.get(cardId);

    if (!card) {
      return null;
    }

    const source =
      this.#sources.get(
        card.__registry.sourceId
      );

    if (
      !source ||
      !source.enabled
    ) {
      return null;
    }

    return publicCard(card);
  }

  getCards(options = {}) {
    const {
      sourceType = "",
      sourceId = "",
      category = "",
      enabledOnly = true,
      limit = 0
    } = options;

    const resolvedCategory =
      category
        ? this.resolveCategory(
            category
          )
        : "";

    const output = [];

    for (
      const card
      of this.#cards.values()
    ) {
      const source =
        this.#sources.get(
          card.__registry.sourceId
        );

      if (!source) {
        continue;
      }

      if (
        enabledOnly &&
        !source.enabled
      ) {
        continue;
      }

      if (
        sourceType &&
        source.type !== sourceType
      ) {
        continue;
      }

      if (
        sourceId &&
        source.id !== sourceId
      ) {
        continue;
      }

      if (
        resolvedCategory &&
        card.category !==
          resolvedCategory
      ) {
        continue;
      }

      output.push(
        publicCard(card)
      );

      if (
        limit > 0 &&
        output.length >= limit
      ) {
        break;
      }
    }

    return output;
  }

  validateCard(card) {
    const errors = [];

    if (
      !card ||
      typeof card !== "object"
    ) {
      return {
        valid: false,
        errors: [
          "資料卡必須是物件。"
        ]
      };
    }

    if (
      !isValidCardId(card.id)
    ) {
      errors.push(
        "id 格式錯誤。"
      );
    }

    if (
      card.schemaVersion !==
      "1.0.0"
    ) {
      errors.push(
        "schemaVersion 必須是 1.0.0。"
      );
    }

    if (
      !this.#categoryById.has(
        card.category
      )
    ) {
      errors.push(
        `無效分類：${card.category || "(空白)"}`
      );
    }

    if (
      !cleanText(card.nameZh)
    ) {
      errors.push(
        "缺少中文名稱 nameZh。"
      );
    }

    if (
      !cleanText(card.nameEn)
    ) {
      errors.push(
        "缺少英文名稱 nameEn。"
      );
    }

    if (
      !card.prompt ||
      !Array.isArray(
        card.prompt.positive
      ) ||
      !Array.isArray(
        card.prompt.negative
      )
    ) {
      errors.push(
        "prompt 必須包含 positive 與 negative 陣列。"
      );
    }

    if (
      !Array.isArray(card.tags)
    ) {
      errors.push(
        "tags 必須是陣列。"
      );
    }

    if (
      !Array.isArray(
        card.platforms
      ) ||
      !card.platforms.length
    ) {
      errors.push(
        "platforms 至少需要一個平台。"
      );
    } else {
      const invalidPlatforms =
        card.platforms.filter(
          (platform) =>
            !PLATFORM_IDS.includes(
              platform
            )
        );

      if (
        invalidPlatforms.length
      ) {
        errors.push(
          `無效平台：${invalidPlatforms.join(", ")}`
        );
      }
    }

    if (
      !Array.isArray(
        card.colorways
      )
    ) {
      errors.push(
        "colorways 必須是陣列。"
      );
    }

    const requiredAttributes = [
      "material",
      "fit",
      "length",
      "sleeve",
      "neckline",
      "gender"
    ];

    if (
      !card.attributes ||
      typeof card.attributes !==
        "object"
    ) {
      errors.push(
        "缺少 attributes。"
      );
    } else {
      requiredAttributes.forEach(
        (attributeId) => {
          if (
            !Array.isArray(
              card.attributes[
                attributeId
              ]
            )
          ) {
            errors.push(
              `attributes.${attributeId} 必須是陣列。`
            );
          }
        }
      );
    }

    if (
      !card.relations ||
      !Array.isArray(
        card.relations
          .similarItems
      ) ||
      !Array.isArray(
        card.relations
          .matchingItems
      )
    ) {
      errors.push(
        "relations 必須包含 similarItems 與 matchingItems。"
      );
    }

    if (
      !card.source ||
      !SOURCE_TYPES.includes(
        card.source.type
      )
    ) {
      errors.push(
        "source.type 必須是 official、custom 或 external。"
      );
    }

    return {
      valid:
        errors.length === 0,

      errors
    };
  }

  resolveCategory(value) {
    const key =
      cleanText(value);

    if (!key) {
      return "";
    }

    if (
      this.#categoryById.has(
        key
      )
    ) {
      return key;
    }

    return (
      this.#categoryLookup.get(
        key.toLowerCase()
      ) ||
      ""
    );
  }

  getCategory(categoryId) {
    const resolved =
      this.resolveCategory(
        categoryId
      );

    if (!resolved) {
      return null;
    }

    return clone(
      this.#categoryById.get(
        resolved
      )
    );
  }

  getCounts() {
    const counts = {
      total:
        0,

      official:
        0,

      custom:
        0,

      external:
        0,

      target:
        Number(
          this.#manifest
            ?.targetCount
        ) || 60000,

      categories: {}
    };

    for (
      const card
      of this.#cards.values()
    ) {
      const source =
        this.#sources.get(
          card.__registry.sourceId
        );

      if (
        !source ||
        !source.enabled
      ) {
        continue;
      }

      counts.total += 1;

      if (
        SOURCE_TYPES.includes(
          source.type
        )
      ) {
        counts[
          source.type
        ] += 1;
      }

      counts.categories[
        card.category
      ] =
        (
          counts.categories[
            card.category
          ] ||
          0
        ) + 1;
    }

    return counts;
  }

  getProductionProgress() {
    const counts =
      this.getCounts();

    const categories =
      (
        this.#manifest
          ?.categories ||
        []
      ).map(
        (entry) => ({
          ...entry,

          loadedCount:
            counts.categories[
              entry.id
            ] ||
            0,

          remaining:
            Math.max(
              0,
              entry.expectedCount -
                (
                  counts.categories[
                    entry.id
                  ] ||
                  0
                )
            )
        })
      );

    return {
      target:
        counts.target,

      loaded:
        counts.official,

      remaining:
        Math.max(
          0,
          counts.target -
            counts.official
        ),

      percentage:
        counts.target > 0
          ? (
              counts.official /
              counts.target
            ) * 100
          : 0,

      categories
    };
  }

  getConflicts() {
    return clone(
      this.#conflicts
    );
  }

  clearConflicts() {
    this.#conflicts = [];
  }

  subscribe(callback) {
    if (
      typeof callback !==
      "function"
    ) {
      throw new TypeError(
        "subscribe() 需要函式。"
      );
    }

    this.#subscribers.add(
      callback
    );

    return () => {
      this.#subscribers.delete(
        callback
      );
    };
  }

  snapshot() {
    return {
      ready:
        this.#ready,

      counts:
        this.getCounts(),

      progress:
        this.getProductionProgress(),

      sources:
        this.getSources(),

      conflicts:
        this.getConflicts()
    };
  }

  #normalizeCard(
    rawCard,
    source
  ) {
    const card =
      clone(rawCard || {});

    const resolvedCategory =
      this.resolveCategory(
        card.category
      );

    if (resolvedCategory) {
      card.category =
        resolvedCategory;
    }

    card.id =
      cleanText(card.id);

    card.schemaVersion =
      cleanText(
        card.schemaVersion
      ) || "1.0.0";

    card.revision =
      Math.max(
        1,
        Number(card.revision) ||
          1
      );

    card.nameZh =
      cleanText(
        card.nameZh
      );

    card.nameEn =
      cleanText(
        card.nameEn
      );

    card.descriptionZh =
      cleanText(
        card.descriptionZh
      );

    card.descriptionEn =
      cleanText(
        card.descriptionEn
      );

    card.tags =
      uniqueStrings(
        card.tags
      );

    card.platforms =
      uniqueStrings(
        card.platforms
      );

    card.colorways =
      Array.isArray(
        card.colorways
      )
        ? card.colorways
        : [];

    card.attributes =
      normalizeAttributes(
        card.attributes
      );

    card.prompt =
      normalizePrompt(
        card.prompt
      );

    card.relations = {
      similarItems:
        uniqueStrings(
          card.relations
            ?.similarItems
        ),

      matchingItems:
        uniqueStrings(
          card.relations
            ?.matchingItems
        )
    };

    card.source = {
      ...(card.source || {}),

      type:
        source.type,

      packId:
        source.packId,

      packVersion:
        source.version
    };

    card.__registry = {
      sourceId:
        source.id,

      registeredAt:
        new Date().toISOString()
    };

    return card;
  }

  #buildCategoryIndexes() {
    this.#categoryById.clear();
    this.#categoryLookup.clear();

    const categories =
      this.#taxonomy
        ?.categories ||
      [];

    for (
      const category
      of categories
    ) {
      this.#categoryById.set(
        category.id,
        category
      );

      [
        category.id,
        category.nameZh,
        category.nameEn
      ]
        .filter(Boolean)
        .forEach((value) => {
          this.#categoryLookup.set(
            String(value)
              .toLowerCase(),
            category.id
          );
        });
    }

    const aliases =
      this.#taxonomy
        ?.aliases ||
      {};

    Object.entries(
      aliases
    ).forEach(
      ([alias, categoryId]) => {
        this.#categoryLookup.set(
          alias.toLowerCase(),
          categoryId
        );
      }
    );
  }

  #updateSourceCount(
    sourceId
  ) {
    const source =
      this.#sources.get(sourceId);

    if (!source) {
      return;
    }

    let count = 0;

    for (
      const card
      of this.#cards.values()
    ) {
      if (
        card.__registry
          .sourceId ===
        sourceId
      ) {
        count += 1;
      }
    }

    source.cardCount =
      count;
  }

  #notify(detail) {
    const message = Object.freeze({
      ...detail,
      timestamp:
        Date.now()
    });

    for (
      const callback
      of this.#subscribers
    ) {
      try {
        callback(
          message,
          this.snapshot()
        );
      } catch (error) {
        console.error(
          "Registry subscriber error:",
          error
        );
      }
    }
  }
}

function normalizeSource(source) {
  if (
    !source ||
    typeof source !== "object"
  ) {
    throw new TypeError(
      "資料來源必須是物件。"
    );
  }

  const id =
    cleanText(
      source.id
    );

  const type =
    cleanText(
      source.type
    );

  if (!id) {
    throw new Error(
      "資料來源缺少 id。"
    );
  }

  if (
    !SOURCE_TYPES.includes(
      type
    )
  ) {
    throw new Error(
      `無效資料來源類型：${type}`
    );
  }

  return {
    id,

    type,

    packId:
      cleanText(
        source.packId
      ) || id,

    version:
      cleanText(
        source.version
      ) || "1.0.0",

    label:
      cleanText(
        source.label
      ) || id,

    enabled:
      source.enabled !== false,

    system:
      Boolean(
        source.system
      )
  };
}

function normalizePrompt(prompt) {
  return {
    positive:
      uniqueStrings(
        prompt?.positive
      ),

    negative:
      uniqueStrings(
        prompt?.negative
      )
  };
}

function normalizeAttributes(
  attributes
) {
  const source =
    attributes &&
    typeof attributes ===
      "object"
      ? attributes
      : {};

  return {
    material:
      normalizeArray(
        source.material
      ),

    fit:
      normalizeArray(
        source.fit
      ),

    length:
      normalizeArray(
        source.length
      ),

    sleeve:
      normalizeArray(
        source.sleeve
      ),

    neckline:
      normalizeArray(
        source.neckline
      ),

    gender:
      normalizeArray(
        source.gender
      )
  };
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const output = [];
  const seen = new Set();

  value.forEach((item) => {
    const text =
      cleanText(item);

    if (!text) {
      return;
    }

    const key =
      text.toLowerCase();

    if (
      seen.has(key)
    ) {
      return;
    }

    seen.add(key);
    output.push(text);
  });

  return output;
}

function publicCard(card) {
  const copy =
    clone(card);

  delete copy.__registry;

  return copy;
}

function isValidCardId(value) {
  return /^[a-z0-9][a-z0-9._-]+$/.test(
    cleanText(value)
  );
}

async function loadJson(url) {
  const response =
    await fetch(
      url,
      {
        cache: "no-store"
      }
    );

  if (!response.ok) {
    throw new Error(
      `資料載入失敗：${url.pathname} (${response.status})`
    );
  }

  return response.json();
}

function clone(value) {
  if (
    typeof structuredClone ===
    "function"
  ) {
    return structuredClone(
      value
    );
  }

  return JSON.parse(
    JSON.stringify(value)
  );
}

function cleanText(value) {
  return String(
    value ?? ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

export const registry =
  new DataRegistry();

export {
  SOURCE_TYPES,
  PLATFORM_IDS
};