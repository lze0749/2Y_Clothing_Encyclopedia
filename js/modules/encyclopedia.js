"use strict";

/*
 * 2Y AI Prompt Encyclopedia
 * Encyclopedia
 * Step 04 integration
 * Version: 1.0.0
 */

import {
  createCardSystem
} from "../ui/card.js";

export function createEncyclopediaController({
  registry,
  onCategoriesChange = () => {},
  onQueryChange = () => {}
}) {
  const state = {
    activated: false,
    showAllExplicit: false,

    categories:
      new Set(),

    query: "",

    sourceType: "all",
    platform: "all",
    material: "all",
    gender: "all",

    sort: "default",

    pageSize: 12,
    page: 1
  };

  let host = null;
  let refs = {};

  let cardSystem = null;

  let unsubscribeRegistry =
    null;

  let cardControlActive =
    false;

  let pendingRegistryRefresh =
    false;

  function mount(target) {
    host = target;

    host.innerHTML =
      createBaseHtml();

    cacheRefs();

    cardSystem =
      createCardSystem({
        registry,
        root: host
      });

    bindEvents();

    refreshFacetOptions();

    render();

    unsubscribeRegistry =
      registry.subscribe(
        handleRegistryChange
      );
  }

  function destroy() {
    unsubscribeRegistry?.();

    unsubscribeRegistry =
      null;

    cardSystem?.destroy();

    cardSystem = null;

    host?.replaceChildren();

    host = null;
    refs = {};
  }

  function cacheRefs() {
    refs.query =
      host.querySelector(
        "[data-ency-filter-query]"
      );

    refs.source =
      host.querySelector(
        "[data-ency-filter-source]"
      );

    refs.platform =
      host.querySelector(
        "[data-ency-filter-platform]"
      );

    refs.material =
      host.querySelector(
        "[data-ency-filter-material]"
      );

    refs.gender =
      host.querySelector(
        "[data-ency-filter-gender]"
      );

    refs.sort =
      host.querySelector(
        "[data-ency-filter-sort]"
      );

    refs.pageSize =
      host.querySelector(
        "[data-ency-filter-page-size]"
      );

    refs.categoryChips =
      host.querySelector(
        "[data-ency-category-chips]"
      );

    refs.summary =
      host.querySelector(
        "[data-ency-summary]"
      );

    refs.results =
      host.querySelector(
        "[data-ency-results]"
      );

    refs.pagination =
      host.querySelector(
        "[data-ency-pagination]"
      );

    refs.initialState =
      host.querySelector(
        "[data-ency-initial-state]"
      );
  }

  function bindEvents() {
    host.addEventListener(
      "click",
      handleClick
    );

    host.addEventListener(
      "change",
      handleChange
    );

    host.addEventListener(
      "input",
      handleInput
    );

    host.addEventListener(
      "focusin",
      handleFocusIn
    );

    host.addEventListener(
      "focusout",
      handleFocusOut
    );
  }

  function handleRegistryChange(
    message
  ) {
    if (
      ![
        "cards-updated",
        "card-removed",
        "source-cards-removed",
        "source-status-changed",
        "source-registered",
        "source-unregistered"
      ].includes(
        message.type
      )
    ) {
      return;
    }

    if (cardControlActive) {
      pendingRegistryRefresh =
        true;

      return;
    }

    refreshFacetOptions();
    render();
  }

  function handleFocusIn(
    event
  ) {
    if (
      event.target.matches?.(
        "[data-card-v1-control]"
      )
    ) {
      cardControlActive =
        true;
    }
  }

  function handleFocusOut(
    event
  ) {
    if (
      !event.target.matches?.(
        "[data-card-v1-control]"
      )
    ) {
      return;
    }

    window.setTimeout(
      () => {
        if (
          document.activeElement
            ?.matches?.(
              "[data-card-v1-control]"
            )
        ) {
          return;
        }

        cardControlActive =
          false;

        if (
          pendingRegistryRefresh
        ) {
          pendingRegistryRefresh =
            false;

          refreshFacetOptions();
          render();
        }
      },
      180
    );
  }

  function handleInput(
    event
  ) {
    if (
      event.target !==
      refs.query
    ) {
      return;
    }

    state.query =
      event.target.value
        .trim();

    state.page = 1;

    if (state.query) {
      state.activated =
        true;
    } else if (
      !state.categories.size &&
      !state.showAllExplicit
    ) {
      state.activated =
        false;
    }

    onQueryChange(
      state.query
    );

    render();
  }

  function handleChange(
    event
  ) {
    const target =
      event.target;

    /*
     * Card controls 由 Card System 自己管理。
     * Encyclopedia 不碰。
     */
    if (
      target.matches?.(
        "[data-card-v1-control]"
      )
    ) {
      return;
    }

    if (
      target === refs.source
    ) {
      state.sourceType =
        target.value;

      state.activated =
        true;
    }

    if (
      target === refs.platform
    ) {
      state.platform =
        target.value;

      state.activated =
        true;
    }

    if (
      target === refs.material
    ) {
      state.material =
        target.value;

      state.activated =
        true;
    }

    if (
      target === refs.gender
    ) {
      state.gender =
        target.value;

      state.activated =
        true;
    }

    if (
      target === refs.sort
    ) {
      state.sort =
        target.value;
    }

    if (
      target === refs.pageSize
    ) {
      state.pageSize =
        Number(
          target.value
        ) || 12;
    }

    state.page = 1;

    render();
  }

  function handleClick(
    event
  ) {
    const target =
      event.target instanceof
      Element
        ? event.target
        : null;

    if (!target) {
      return;
    }

    if (
      target.closest(
        "[data-ency-show-all]"
      )
    ) {
      showAll();

      return;
    }

    if (
      target.closest(
        "[data-ency-clear]"
      )
    ) {
      clear();

      return;
    }

    const category =
      target.closest(
        "[data-ency-remove-category]"
      );

    if (category) {
      removeCategory(
        category.dataset
          .encyRemoveCategory
      );

      return;
    }

    const pageButton =
      target.closest(
        "[data-ency-page]"
      );

    if (pageButton) {
      state.page =
        Math.max(
          1,
          Number(
            pageButton.dataset
              .encyPage
          ) || 1
        );

      render();

      host.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }

  function setCategories(
    categories
  ) {
    state.categories =
      new Set(
        categories
          .map(
            (value) =>
              registry
                .resolveCategory(
                  value
                )
          )
          .filter(Boolean)
      );

    if (
      state.categories.size
    ) {
      state.showAllExplicit =
        false;

      state.activated =
        true;
    } else if (
      !state.query &&
      !state.showAllExplicit
    ) {
      state.activated =
        false;
    }

    state.page = 1;

    render();
  }

  function setQuery(query) {
    state.query =
      String(
        query || ""
      ).trim();

    if (refs.query) {
      refs.query.value =
        state.query;
    }

    if (state.query) {
      state.activated =
        true;
    } else if (
      !state.categories.size &&
      !state.showAllExplicit
    ) {
      state.activated =
        false;
    }

    state.page = 1;

    render();
  }

  function showAll() {
    state.categories.clear();

    state.showAllExplicit =
      true;

    state.activated =
      true;

    state.page = 1;

    onCategoriesChange([]);

    render();
  }

  function clear() {
    state.activated =
      false;

    state.showAllExplicit =
      false;

    state.categories.clear();

    state.query = "";

    state.sourceType =
      "all";

    state.platform =
      "all";

    state.material =
      "all";

    state.gender =
      "all";

    state.sort =
      "default";

    state.pageSize =
      12;

    state.page = 1;

    onCategoriesChange([]);
    onQueryChange("");

    syncControls();
    render();
  }

  function removeCategory(
    categoryId
  ) {
    state.categories.delete(
      categoryId
    );

    state.page = 1;

    if (
      !state.categories.size &&
      !state.query &&
      !state.showAllExplicit
    ) {
      state.activated =
        false;
    }

    onCategoriesChange(
      [
        ...state.categories
      ]
    );

    render();
  }

  function refreshFacetOptions() {
    const cards =
      registry.getCards({
        enabledOnly: true
      });

    replaceFacetOptions(
      refs.material,
      "全部材質",
      collectAttributeValues(
        cards,
        "material"
      ),
      state.material
    );

    replaceFacetOptions(
      refs.gender,
      "全部性別",
      collectAttributeValues(
        cards,
        "gender"
      ),
      state.gender
    );
  }

  function render() {
    if (!host) {
      return;
    }

    syncControls();

    renderCategoryChips();

    if (!state.activated) {
      renderInitialState();

      return;
    }

    const filtered =
      getFilteredCards();

    const total =
      filtered.length;

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          total /
          state.pageSize
        )
      );

    state.page =
      Math.min(
        Math.max(
          1,
          state.page
        ),
        totalPages
      );

    const start =
      (
        state.page - 1
      ) *
      state.pageSize;

    const pageCards =
      filtered.slice(
        start,
        start +
        state.pageSize
      );

    refs.initialState.hidden =
      true;

    refs.results.hidden =
      false;

    refs.summary.textContent =
      total
        ? `找到 ${total.toLocaleString(
            "zh-TW"
          )} 筆，第 ${state.page} / ${totalPages} 頁`
        : createEmptySummary();

    renderCards(
      pageCards
    );

    renderPagination(
      totalPages
    );
  }

  function renderInitialState() {
    refs.results.hidden =
      true;

    refs.results
      .replaceChildren();

    refs.pagination.hidden =
      true;

    refs.pagination
      .replaceChildren();

    refs.initialState.hidden =
      false;

    refs.summary.textContent =
      `Registry 已連線，目前載入 ${registry
        .getCounts()
        .total
        .toLocaleString(
          "zh-TW"
        )} 張資料卡。`;

    refs.initialState.innerHTML = `
      <div class="ency-initial-icon">
        🍮
      </div>

      <h3>
        百科已準備好，但沒有自動倒出全部資料卡
      </h3>

      <p>
        從左側複選分類、輸入搜尋內容，
        或按「顯示全部資料卡」後才顯示結果。
      </p>
    `;
  }

  function renderCards(
    cards
  ) {
    const fragment =
      document.createDocumentFragment();

    cards.forEach(
      (card) => {
        fragment.append(
          cardSystem
            .createCardElement(
              card
            )
        );
      }
    );

    refs.results
      .replaceChildren(
        fragment
      );
  }

  function getFilteredCards() {
    const query =
      state.query
        .toLowerCase();

    const cards =
      registry
        .getCards({
          enabledOnly: true
        })
        .filter(
          (card) => {
            if (
              state.categories.size &&
              !state.categories.has(
                card.category
              )
            ) {
              return false;
            }

            if (
              state.sourceType !==
                "all" &&
              card.source?.type !==
                state.sourceType
            ) {
              return false;
            }

            if (
              state.platform !==
                "all" &&
              !card.platforms.includes(
                state.platform
              )
            ) {
              return false;
            }

            if (
              state.material !==
                "all" &&
              !hasAttributeValue(
                card,
                "material",
                state.material
              )
            ) {
              return false;
            }

            if (
              state.gender !==
                "all" &&
              !hasAttributeValue(
                card,
                "gender",
                state.gender
              )
            ) {
              return false;
            }

            if (
              query &&
              !createSearchText(
                card
              ).includes(query)
            ) {
              return false;
            }

            return true;
          }
        );

    sortCards(cards);

    return cards;
  }

  function sortCards(cards) {
    const zh =
      new Intl.Collator(
        "zh-Hant"
      );

    const en =
      new Intl.Collator(
        "en"
      );

    if (
      state.sort ===
      "name-zh"
    ) {
      cards.sort(
        (a, b) =>
          zh.compare(
            a.nameZh,
            b.nameZh
          )
      );

      return;
    }

    if (
      state.sort ===
      "name-en"
    ) {
      cards.sort(
        (a, b) =>
          en.compare(
            a.nameEn,
            b.nameEn
          )
      );

      return;
    }

    if (
      state.sort ===
      "updated"
    ) {
      cards.sort(
        (a, b) =>
          dateValue(
            b.metadata
              ?.updatedAt
          ) -
          dateValue(
            a.metadata
              ?.updatedAt
          )
      );

      return;
    }

    cards.sort(
      (a, b) => {
        const categoryCompare =
          zh.compare(
            getCategoryName(
              a.category
            ),
            getCategoryName(
              b.category
            )
          );

        if (
          state.sort ===
          "category" &&
          categoryCompare !== 0
        ) {
          return categoryCompare;
        }

        return (
          categoryCompare ||
          zh.compare(
            a.nameZh,
            b.nameZh
          )
        );
      }
    );
  }

  function renderCategoryChips() {
    if (
      !state.categories.size
    ) {
      refs.categoryChips
        .innerHTML = `
          <span class="ency-category-empty">
            ${
              state.showAllExplicit
                ? "全部分類"
                : "尚未選擇分類"
            }
          </span>
        `;

      return;
    }

    refs.categoryChips
      .innerHTML =
        [
          ...state.categories
        ]
          .map(
            (categoryId) => `
              <button
                type="button"
                data-ency-remove-category="${escapeHtml(
                  categoryId
                )}"
              >
                ${escapeHtml(
                  getCategoryName(
                    categoryId
                  )
                )}
                ×
              </button>
            `
          )
          .join("");
  }

  function renderPagination(
    totalPages
  ) {
    if (
      totalPages <= 1
    ) {
      refs.pagination.hidden =
        true;

      refs.pagination
        .replaceChildren();

      return;
    }

    refs.pagination.hidden =
      false;

    const pages =
      createPageNumbers(
        state.page,
        totalPages
      );

    refs.pagination.innerHTML = `
      <button
        type="button"
        data-ency-page="${Math.max(
          1,
          state.page - 1
        )}"
        ${
          state.page === 1
            ? "disabled"
            : ""
        }
      >
        ←
      </button>

      ${pages
        .map(
          (page) => `
            <button
              type="button"
              class="${
                page === state.page
                  ? "is-current"
                  : ""
              }"
              data-ency-page="${page}"
            >
              ${page}
            </button>
          `
        )
        .join("")}

      <button
        type="button"
        data-ency-page="${Math.min(
          totalPages,
          state.page + 1
        )}"
        ${
          state.page ===
          totalPages
            ? "disabled"
            : ""
        }
      >
        →
      </button>
    `;
  }

  function syncControls() {
    if (
      refs.query &&
      document.activeElement !==
      refs.query
    ) {
      refs.query.value =
        state.query;
    }

    setSelect(
      refs.source,
      state.sourceType
    );

    setSelect(
      refs.platform,
      state.platform
    );

    setSelect(
      refs.material,
      state.material
    );

    setSelect(
      refs.gender,
      state.gender
    );

    setSelect(
      refs.sort,
      state.sort
    );

    setSelect(
      refs.pageSize,
      String(
        state.pageSize
      )
    );
  }

  function getCategoryName(
    categoryId
  ) {
    return (
      registry
        .getCategory(
          categoryId
        )
        ?.nameZh ||
      categoryId
    );
  }

  function createEmptySummary() {
    return registry
      .getCounts()
      .total
      ? "沒有符合目前條件的資料卡。"
      : "Registry 正常，目前尚未載入正式資料卡。";
  }

  function createBaseHtml() {
    return `
      <div class="ency-toolbar">

        <div>
          <div class="panel-kicker">
            ENCYCLOPEDIA FILTER
          </div>

          <h3>
            百科篩選器
          </h3>

          <p>
            初始不顯示全部資料卡。
          </p>
        </div>

        <div class="ency-toolbar-actions">

          <button
            class="primary-button"
            type="button"
            data-ency-show-all
          >
            顯示全部資料卡
          </button>

          <button
            class="ency-secondary-button"
            type="button"
            data-ency-clear
          >
            清除全部
          </button>

        </div>

      </div>

      <div class="ency-filter-grid">

        <label class="ency-filter-wide">
          <span>
            關鍵字
          </span>

          <input
            type="search"
            autocomplete="off"
            data-ency-filter-query
            placeholder="名稱、標籤、Prompt…"
          >
        </label>

        <label>
          <span>
            資料來源
          </span>

          <select
            data-ency-filter-source
          >
            <option value="all">
              全部來源
            </option>

            <option value="official">
              官方預設
            </option>

            <option value="custom">
              自訂資料
            </option>

            <option value="external">
              外掛資料
            </option>
          </select>
        </label>

        <label>
          <span>
            適用平台
          </span>

          <select
            data-ency-filter-platform
          >
            <option value="all">
              全部平台
            </option>

            <option value="pixai">
              PixAI
            </option>

            <option value="niji">
              Niji
            </option>

            <option value="tensorart">
              TensorArt
            </option>

            <option value="gpt-image">
              GPT Image
            </option>
          </select>
        </label>

        <label>
          <span>
            材質
          </span>

          <select
            data-ency-filter-material
          >
            <option value="all">
              全部材質
            </option>
          </select>
        </label>

        <label>
          <span>
            性別
          </span>

          <select
            data-ency-filter-gender
          >
            <option value="all">
              全部性別
            </option>
          </select>
        </label>

        <label>
          <span>
            排序
          </span>

          <select
            data-ency-filter-sort
          >
            <option value="default">
              預設排序
            </option>

            <option value="name-zh">
              中文名稱
            </option>

            <option value="name-en">
              英文名稱
            </option>

            <option value="category">
              分類
            </option>

            <option value="updated">
              最近更新
            </option>
          </select>
        </label>

        <label>
          <span>
            每頁顯示
          </span>

          <select
            data-ency-filter-page-size
          >
            <option value="6">
              6 筆
            </option>

            <option
              value="12"
              selected
            >
              12 筆
            </option>

            <option value="24">
              24 筆
            </option>

            <option value="48">
              48 筆
            </option>
          </select>
        </label>

      </div>

      <div class="ency-selected-categories">

        <strong>
          已選分類
        </strong>

        <div
          class="ency-category-chips"
          data-ency-category-chips
        ></div>

      </div>

      <div
        class="ency-result-summary"
        data-ency-summary
      ></div>

      <div
        class="ency-initial-state"
        data-ency-initial-state
      ></div>

      <div
        class="ency-card-grid"
        data-ency-results
        hidden
      ></div>

      <nav
        class="ency-pagination"
        data-ency-pagination
        hidden
      ></nav>
    `;
  }

  return Object.freeze({
    mount,
    destroy,
    setCategories,
    setQuery,
    showAll,

    refresh() {
      refreshFacetOptions();
      render();
    },

    getCardSelection(
      cardId
    ) {
      return cardSystem
        ?.getSelection(
          cardId
        ) ||
        null;
    },

    openCardDetail(
      cardId
    ) {
      cardSystem
        ?.openDetail(
          cardId
        );
    }
  });
}

/* ============================================
   Helpers
============================================ */

function collectAttributeValues(
  cards,
  attributeId
) {
  const values =
    new Map();

  cards.forEach(
    (card) => {
      (
        card.attributes?.[
          attributeId
        ] ||
        []
      ).forEach(
        (option) => {
          const label =
            String(
              option.nameZh ||
              option.nameEn ||
              ""
            ).trim();

          if (!label) {
            return;
          }

          values.set(
            label.toLowerCase(),
            label
          );
        }
      );
    }
  );

  return [
    ...values.values()
  ].sort(
    (a, b) =>
      a.localeCompare(
        b,
        "zh-Hant"
      )
  );
}

function replaceFacetOptions(
  select,
  allLabel,
  values,
  selected
) {
  if (!select) {
    return;
  }

  select.innerHTML = `
    <option value="all">
      ${escapeHtml(
        allLabel
      )}
    </option>

    ${values
      .map(
        (value) => `
          <option
            value="${escapeHtml(
              value
            )}"
          >
            ${escapeHtml(
              value
            )}
          </option>
        `
      )
      .join("")}
  `;

  setSelect(
    select,
    selected
  );
}

function setSelect(
  select,
  value
) {
  if (!select) {
    return;
  }

  const exists =
    [
      ...select.options
    ].some(
      (option) =>
        option.value ===
        value
    );

  select.value =
    exists
      ? value
      : "all";
}

function hasAttributeValue(
  card,
  attributeId,
  targetValue
) {
  const target =
    String(targetValue)
      .trim()
      .toLowerCase();

  return (
    card.attributes?.[
      attributeId
    ] ||
    []
  ).some(
    (option) =>
      [
        option.id,
        option.nameZh,
        option.nameEn
      ]
        .filter(Boolean)
        .some(
          (value) =>
            String(value)
              .trim()
              .toLowerCase() ===
            target
        )
  );
}

function createSearchText(
  card
) {
  return [
    card.id,
    card.nameZh,
    card.nameEn,
    card.descriptionZh,
    card.descriptionEn,
    card.subcategory,

    ...(card.tags || []),

    ...(card.prompt?.positive || []),

    ...(card.prompt?.negative || []),

    ...(card.colorways || [])
      .flatMap(
        (colorway) => [
          colorway.nameZh,
          colorway.nameEn,
          ...(colorway.prompt || []),

          ...(colorway.palette || [])
            .flatMap(
              (color) => [
                color.nameZh,
                color.nameEn
              ]
            )
        ]
      ),

    ...Object
      .values(
        card.attributes ||
        {}
      )
      .flat()
      .flatMap(
        (option) => [
          option.id,
          option.nameZh,
          option.nameEn,
          option.prompt
        ]
      )
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function createPageNumbers(
  current,
  total
) {
  const start =
    Math.max(
      1,
      current - 2
    );

  const end =
    Math.min(
      total,
      current + 2
    );

  const output = [];

  for (
    let page = start;
    page <= end;
    page += 1
  ) {
    output.push(page);
  }

  return output;
}

function dateValue(value) {
  const result =
    new Date(
      value || 0
    ).getTime();

  return Number.isFinite(
    result
  )
    ? result
    : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}