"use strict";

/*
 * 2Y AI Prompt Encyclopedia
 * Search Worker
 * Step 05
 * Version: 1.0.0
 *
 * 所有全文搜尋與 Ranking 都在 Worker 執行。
 * 主執行緒只拿搜尋結果。
 */

const documents =
  new Map();

const postings =
  new Map();

const documentTokens =
  new Map();

self.addEventListener(
  "message",
  handleMessage
);

async function handleMessage(
  event
) {
  const {
    requestId,
    type,
    payload = {}
  } =
    event.data || {};

  try {
    let result;

    switch (type) {
      case "INIT":
        result =
          initialize();
        break;

      case "UPSERT_DOCUMENTS":
        result =
          upsertDocuments(
            payload.documents
          );
        break;

      case "REMOVE_IDS":
        result =
          removeIds(
            payload.ids
          );
        break;

      case "REMOVE_SOURCE":
        result =
          removeSource(
            payload.sourceId
          );
        break;

      case "SEARCH":
        result =
          search(
            payload
          );
        break;

      case "FACETS":
        result =
          collectFacets(
            payload
          );
        break;

      case "STATUS":
        result =
          getStatus();
        break;

      default:
        throw new Error(
          `未知 Search Worker 指令：${type}`
        );
    }

    self.postMessage({
      requestId,
      ok: true,
      result
    });
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,

      error:
        error?.message ||
        String(error)
    });
  }
}

function initialize() {
  documents.clear();
  postings.clear();
  documentTokens.clear();

  return getStatus();
}

/* ============================================
   Index
============================================ */

function upsertDocuments(
  input
) {
  const list =
    Array.isArray(input)
      ? input
      : [];

  let inserted = 0;

  list.forEach(
    (rawDocument) => {
      const document =
        normalizeDocument(
          rawDocument
        );

      if (!document.id) {
        return;
      }

      if (
        documents.has(
          document.id
        )
      ) {
        removeDocument(
          document.id
        );
      }

      documents.set(
        document.id,
        document
      );

      const tokens =
        createDocumentTokens(
          document
        );

      documentTokens.set(
        document.id,
        tokens
      );

      tokens.forEach(
        (token) => {
          let set =
            postings.get(
              token
            );

          if (!set) {
            set =
              new Set();

            postings.set(
              token,
              set
            );
          }

          set.add(
            document.id
          );
        }
      );

      inserted += 1;
    }
  );

  return {
    inserted,
    documentCount:
      documents.size,

    tokenCount:
      postings.size
  };
}

function removeIds(
  ids
) {
  let removed = 0;

  (
    Array.isArray(ids)
      ? ids
      : []
  ).forEach(
    (id) => {
      if (
        removeDocument(id)
      ) {
        removed += 1;
      }
    }
  );

  return {
    removed,
    documentCount:
      documents.size
  };
}

function removeSource(
  sourceId
) {
  const ids = [];

  for (
    const [
      id,
      document
    ]
    of documents
  ) {
    if (
      document.sourceId ===
      sourceId
    ) {
      ids.push(id);
    }
  }

  return removeIds(ids);
}

function removeDocument(
  id
) {
  if (
    !documents.has(id)
  ) {
    return false;
  }

  const tokens =
    documentTokens.get(
      id
    ) ||
    new Set();

  tokens.forEach(
    (token) => {
      const set =
        postings.get(
          token
        );

      if (!set) {
        return;
      }

      set.delete(id);

      if (!set.size) {
        postings.delete(
          token
        );
      }
    }
  );

  documentTokens.delete(id);
  documents.delete(id);

  return true;
}

/* ============================================
   Search
============================================ */

function search(
  payload
) {
  const query =
    normalizeText(
      payload.query
    );

  const filters =
    normalizeFilters(
      payload.filters
    );

  const offset =
    Math.max(
      0,
      Number(
        payload.offset
      ) || 0
    );

  const limit =
    Math.max(
      1,
      Math.min(
        200,
        Number(
          payload.limit
        ) || 12
      )
    );

  const sort =
    payload.sort ||
    "default";

  let candidates;

  if (query) {
    candidates =
      getQueryCandidates(
        query
      );
  } else {
    candidates =
      [
        ...documents.keys()
      ];
  }

  let results =
    candidates
      .map(
        (id) =>
          documents.get(id)
      )
      .filter(Boolean)
      .filter(
        (document) =>
          matchesFilters(
            document,
            filters
          )
      )
      .map(
        (document) => ({
          document,

          score:
            query
              ? calculateScore(
                  document,
                  query
                )
              : 0
        })
      );

  sortResults(
    results,
    sort,
    Boolean(query)
  );

  const total =
    results.length;

  const page =
    results
      .slice(
        offset,
        offset + limit
      )
      .map(
        ({
          document,
          score
        }) => ({
          id:
            document.id,

          score,

          category:
            document.category,

          sourceType:
            document.sourceType,

          sourceId:
            document.sourceId,

          chunk:
            document.chunk,

          chunkNumber:
            document.chunkNumber,

          nameZh:
            document.nameZh,

          nameEn:
            document.nameEn,

          updatedAt:
            document.updatedAt
        })
      );

  return {
    query,
    total,
    offset,
    limit,
    hits: page,

    indexCount:
      documents.size
  };
}

function getQueryCandidates(
  query
) {
  const tokens =
    tokenize(
      query
    );

  if (!tokens.size) {
    return [];
  }

  const sets =
    [
      ...tokens
    ].map(
      (token) =>
        postings.get(
          token
        )
    );

  if (
    sets.some(
      (set) =>
        !set ||
        !set.size
    )
  ) {
    return [];
  }

  sets.sort(
    (a, b) =>
      a.size -
      b.size
  );

  let intersection =
    new Set(
      sets[0]
    );

  for (
    let index = 1;
    index < sets.length;
    index += 1
  ) {
    const next =
      sets[index];

    intersection =
      new Set(
        [
          ...intersection
        ].filter(
          (id) =>
            next.has(id)
        )
      );

    if (!intersection.size) {
      break;
    }
  }

  return [
    ...intersection
  ];
}

function calculateScore(
  document,
  query
) {
  let score = 0;

  const fields =
    document.normalized;

  if (
    fields.nameZh ===
      query ||
    fields.nameEn ===
      query
  ) {
    score += 150;
  }

  if (
    fields.nameZh.includes(
      query
    ) ||
    fields.nameEn.includes(
      query
    )
  ) {
    score += 80;
  }

  if (
    fields.tags.some(
      (tag) =>
        tag === query
    )
  ) {
    score += 55;
  }

  if (
    fields.tags.some(
      (tag) =>
        tag.includes(query)
    )
  ) {
    score += 35;
  }

  if (
    fields.materials.some(
      (material) =>
        material === query
    )
  ) {
    score += 40;
  }

  if (
    fields.materials.some(
      (material) =>
        material.includes(
          query
        )
    )
  ) {
    score += 28;
  }

  if (
    fields.colors.some(
      (color) =>
        color.includes(
          query
        )
    )
  ) {
    score += 25;
  }

  if (
    fields.positivePrompt.includes(
      query
    )
  ) {
    score += 22;
  }

  if (
    fields.description.includes(
      query
    )
  ) {
    score += 14;
  }

  if (
    fields.negativePrompt.includes(
      query
    )
  ) {
    score += 7;
  }

  const queryTokens =
    tokenize(query);

  const docTokens =
    documentTokens.get(
      document.id
    ) ||
    new Set();

  queryTokens.forEach(
    (token) => {
      if (
        docTokens.has(
          token
        )
      ) {
        score += 3;
      }
    }
  );

  return score;
}

/* ============================================
   Filters
============================================ */

function normalizeFilters(
  value
) {
  const filters =
    value &&
    typeof value ===
      "object"
      ? value
      : {};

  return {
    categories:
      new Set(
        Array.isArray(
          filters.categories
        )
          ? filters.categories
          : []
      ),

    sourceType:
      filters.sourceType ||
      "all",

    platform:
      filters.platform ||
      "all",

    material:
      normalizeText(
        filters.material
      ),

    gender:
      normalizeText(
        filters.gender
      ),

    enabledSourceIds:
      new Set(
        Array.isArray(
          filters.enabledSourceIds
        )
          ? filters.enabledSourceIds
          : []
      )
  };
}

function matchesFilters(
  document,
  filters
) {
  if (
    filters.enabledSourceIds.size &&
    !filters.enabledSourceIds.has(
      document.sourceId
    )
  ) {
    return false;
  }

  if (
    filters.categories.size &&
    !filters.categories.has(
      document.category
    )
  ) {
    return false;
  }

  if (
    filters.sourceType !==
      "all" &&
    document.sourceType !==
      filters.sourceType
  ) {
    return false;
  }

  if (
    filters.platform !==
      "all" &&
    !document.platforms.includes(
      filters.platform
    )
  ) {
    return false;
  }

  if (
    filters.material &&
    !document.normalized
      .materials
      .includes(
        filters.material
      )
  ) {
    return false;
  }

  if (
    filters.gender &&
    !document.normalized
      .genders
      .includes(
        filters.gender
      )
  ) {
    return false;
  }

  return true;
}

/* ============================================
   Sorting
============================================ */

function sortResults(
  results,
  sort,
  hasQuery
) {
  const zh =
    new Intl.Collator(
      "zh-Hant"
    );

  const en =
    new Intl.Collator(
      "en"
    );

  if (
    sort === "name-zh"
  ) {
    results.sort(
      (a, b) =>
        zh.compare(
          a.document.nameZh,
          b.document.nameZh
        )
    );

    return;
  }

  if (
    sort === "name-en"
  ) {
    results.sort(
      (a, b) =>
        en.compare(
          a.document.nameEn,
          b.document.nameEn
        )
    );

    return;
  }

  if (
    sort === "category"
  ) {
    results.sort(
      (a, b) =>
        zh.compare(
          a.document.category,
          b.document.category
        ) ||
        zh.compare(
          a.document.nameZh,
          b.document.nameZh
        )
    );

    return;
  }

  if (
    sort === "updated"
  ) {
    results.sort(
      (a, b) =>
        dateValue(
          b.document.updatedAt
        ) -
        dateValue(
          a.document.updatedAt
        )
    );

    return;
  }

  if (hasQuery) {
    results.sort(
      (a, b) =>
        b.score -
          a.score ||
        zh.compare(
          a.document.nameZh,
          b.document.nameZh
        )
    );

    return;
  }

  results.sort(
    (a, b) =>
      zh.compare(
        a.document.category,
        b.document.category
      ) ||
      zh.compare(
        a.document.nameZh,
        b.document.nameZh
      )
  );
}

/* ============================================
   Facets
============================================ */

function collectFacets(
  payload
) {
  const filters =
    normalizeFilters({
      categories:
        payload.categories,

      enabledSourceIds:
        payload.enabledSourceIds
    });

  const materials =
    new Map();

  const genders =
    new Map();

  const platforms =
    new Map();

  const sources =
    new Map();

  for (
    const document
    of documents.values()
  ) {
    if (
      !matchesFilters(
        document,
        filters
      )
    ) {
      continue;
    }

    document.materials
      .forEach(
        (value) =>
          storeFacet(
            materials,
            value
          )
      );

    document.genders
      .forEach(
        (value) =>
          storeFacet(
            genders,
            value
          )
      );

    document.platforms
      .forEach(
        (value) =>
          storeFacet(
            platforms,
            value
          )
      );

    sources.set(
      document.sourceType,
      (
        sources.get(
          document.sourceType
        ) ||
        0
      ) + 1
    );
  }

  return {
    materials:
      sortFacetValues(
        materials
      ),

    genders:
      sortFacetValues(
        genders
      ),

    platforms:
      sortFacetValues(
        platforms
      ),

    sources:
      Object.fromEntries(
        sources
      )
  };
}

function storeFacet(
  map,
  value
) {
  const text =
    String(value || "")
      .trim();

  if (!text) {
    return;
  }

  const key =
    normalizeText(text);

  if (!map.has(key)) {
    map.set(
      key,
      text
    );
  }
}

function sortFacetValues(
  map
) {
  return [
    ...map.values()
  ].sort(
    (a, b) =>
      a.localeCompare(
        b,
        "zh-Hant"
      )
  );
}

/* ============================================
   Document
============================================ */

function normalizeDocument(
  input
) {
  const raw =
    input &&
    typeof input ===
      "object"
      ? input
      : {};

  const document = {
    id:
      String(
        raw.id || ""
      ).trim(),

    category:
      String(
        raw.category || ""
      ).trim(),

    sourceType:
      String(
        raw.sourceType ||
        "official"
      ).trim(),

    sourceId:
      String(
        raw.sourceId ||
        raw.packId ||
        "2y.core"
      ).trim(),

    chunk:
      String(
        raw.chunk || ""
      ).trim(),

    chunkNumber:
      Number(
        raw.chunkNumber
      ) || 0,

    nameZh:
      String(
        raw.nameZh || ""
      ).trim(),

    nameEn:
      String(
        raw.nameEn || ""
      ).trim(),

    description:
      String(
        raw.description || ""
      ).trim(),

    tags:
      stringArray(
        raw.tags
      ),

    materials:
      stringArray(
        raw.materials
      ),

    genders:
      stringArray(
        raw.genders
      ),

    platforms:
      stringArray(
        raw.platforms
      ),

    colors:
      stringArray(
        raw.colors
      ),

    positivePrompt:
      stringArray(
        raw.positivePrompt
      ),

    negativePrompt:
      stringArray(
        raw.negativePrompt
      ),

    updatedAt:
      String(
        raw.updatedAt || ""
      ).trim()
  };

  document.normalized = {
    nameZh:
      normalizeText(
        document.nameZh
      ),

    nameEn:
      normalizeText(
        document.nameEn
      ),

    description:
      normalizeText(
        document.description
      ),

    tags:
      document.tags.map(
        normalizeText
      ),

    materials:
      document.materials.map(
        normalizeText
      ),

    genders:
      document.genders.map(
        normalizeText
      ),

    colors:
      document.colors.map(
        normalizeText
      ),

    positivePrompt:
      normalizeText(
        document
          .positivePrompt
          .join(" ")
      ),

    negativePrompt:
      normalizeText(
        document
          .negativePrompt
          .join(" ")
      )
  };

  return document;
}

function createDocumentTokens(
  document
) {
  return tokenize(
    [
      document.nameZh,
      document.nameEn,
      document.description,

      ...document.tags,
      ...document.materials,
      ...document.genders,
      ...document.colors,

      ...document.positivePrompt,
      ...document.negativePrompt
    ].join(" ")
  );
}

/* ============================================
   Tokenization
============================================ */

function tokenize(
  value
) {
  const text =
    normalizeText(
      value
    );

  const result =
    new Set();

  const parts =
    text.match(
      /[a-z0-9]+|[\u3400-\u9fff]+/g
    ) ||
    [];

  parts.forEach(
    (part) => {
      if (
        /^[a-z0-9]+$/.test(
          part
        )
      ) {
        addLatinTokens(
          result,
          part
        );

        return;
      }

      addCjkTokens(
        result,
        part
      );
    }
  );

  return result;
}

function addLatinTokens(
  output,
  word
) {
  output.add(word);

  if (
    word.length < 3
  ) {
    return;
  }

  const max =
    Math.min(
      word.length,
      10
    );

  for (
    let length = 2;
    length <= max;
    length += 1
  ) {
    output.add(
      word.slice(
        0,
        length
      )
    );
  }
}

function addCjkTokens(
  output,
  text
) {
  const chars =
    [...text];

  chars.forEach(
    (char) =>
      output.add(char)
  );

  for (
    let size = 2;
    size <= 3;
    size += 1
  ) {
    for (
      let index = 0;
      index <=
        chars.length -
          size;
      index += 1
    ) {
      output.add(
        chars
          .slice(
            index,
            index + size
          )
          .join("")
      );
    }
  }
}

/* ============================================
   Status / Helpers
============================================ */

function getStatus() {
  return {
    ready: true,

    documentCount:
      documents.size,

    tokenCount:
      postings.size
  };
}

function stringArray(
  value
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      (item) =>
        String(
          item || ""
        ).trim()
    )
    .filter(Boolean);
}

function normalizeText(
  value
) {
  return String(
    value || ""
  )
    .normalize("NFKC")
    .toLowerCase()
    .replace(
      /[，。！？；：、,.!?;:()[\]{}"'`~@#$%^&*_+=|\\/<>-]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function dateValue(
  value
) {
  const time =
    new Date(
      value || 0
    ).getTime();

  return Number.isFinite(
    time
  )
    ? time
    : 0;
}