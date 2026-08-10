"use strict";

/*
 * 2Y AI Prompt Encyclopedia
 * Encyclopedia
 * Step 05 Search Integration
 * Version: 1.0.0
 */

import {
  createCardSystem
} from "../ui/card.js";

import {
  searchEngine
} from "../core/search-engine.js";

import {
  presetLoader
} from "../core/preset-loader.js";

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

  let searchReady = false;

  let renderSequence = 0;

  let searchTimer = null;

  let cardControlActive =
    false;

  let pendingRegistryRefresh =
    false;

  /* ========================================
     Lifecycle
  ======================================== */

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

    renderInitialState();

    initializeSearchPipeline();
  }

  async function initializeSearchPipeline() {
    setSearchStatus(
      "搜尋引擎啟動中…",
      "busy"
    );

    try {
      await Promise.all([
        presetLoader.init(
          registry
        ),

        searchEngine.init(
          registry
        )
      ]);

      searchReady =
        true;

      await refreshFacetOptions();

      const status =
        await searchEngine
          .status();

      setSearchStatus(
        `Search Worker 已就緒 · 索引 ${status.documentCount.toLocaleString(
          "zh-TW"
        )} 筆 · 預先索引 Segment ${status.loadedSegments}/${status.availableSegments}`,
        "ready"
      );

      render();

      unsubscribeRegistry =
        registry.subscribe(
          handleRegistryChange
        );
    } catch (error) {
      console.error(
        "Search Engine 初始化失敗：",
        error
      );

      setSearchStatus(
        `搜尋引擎初始化失敗：${error.message}`,
        "error"
      );
    }
  }

  function destroy() {
    window.clearTimeout(
      searchTimer
    );

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

    refs.searchStatus =
      host.querySelector(
        "[data-ency-search-status]"
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

  /* ========================================
     Registry Events
  ======================================== */

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

    if (
      cardControlActive
    ) {
      pendingRegistryRefresh =
        true;

      return;
    }

    scheduleRefresh();
  }

  function scheduleRefresh() {
    window.clearTimeout(
      searchTimer
    );

    searchTimer =
      window.setTimeout(
        async () => {
          await refreshFacetOptions();

          render();
        },
        80
      );
  }

  /* ========================================
     Events
  ======================================== */

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

          scheduleRefresh();
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
      event.target
        .value
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

    window.clearTimeout(
      searchTimer
    );

    if (
      state.query
    ) {
      setSearchStatus(
        "正在等待輸入完成…",
        "busy"
      );
    }

    searchTimer =
      window.setTimeout(
        () => {
          render();
        },
        180
      );
  }

  function handleChange(
    event
  ) {
    const target =
      event.target;

    /*
     * Card 控制器交給 Card System。
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
        behavior:
          "smooth",

        block:
          "start"
      });
    }
  }

  /* ========================================
     Public State
  ======================================== */

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

    /*
     * 官方資料未來只預載選中分類的第一個已發布 Chunk。
     */
    presetLoader
      .primeCategories(
        [
          ...state.categories
        ]
      )
      .then(
        () =>
          refreshFacetOptions()
      )
      .catch(
        console.error
      );

    render();
  }

  function setQuery(
    query
  ) {
    state.query =
      String(
        query || ""
      ).trim();

    if (refs.query) {
      refs.query.value =
        state.query;
    }

    if (
      state.query
    ) {
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
    state.categories
      .clear();

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

    state.categories
      .clear();

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

    refreshFacetOptions();

    render();
  }

  function removeCategory(
    categoryId
  ) {
    state.categories
      .delete(
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

    refreshFacetOptions();

    render();
  }

  /* ========================================
     Search
  ======================================== */

  async function render() {
    const sequence =
      ++renderSequence;

    if (!host) {
      return;
    }

    syncControls();

    renderCategoryChips();

    if (
      !state.activated
    ) {
      renderInitialState();

      return;
    }

    if (
      !searchReady
    ) {
      renderSearchLoading();

      return;
    }

    setSearchStatus(
      state.query
        ? `正在搜尋「${state.query}」…`
        : "正在讀取索引…",

      "busy"
    );

    try {
      let offset =
        (
          state.page - 1
        ) *
        state.pageSize;

      let result =
        await executeSearch(
          offset
        );

      if (
        sequence !==
        renderSequence
      ) {
        return;
      }

      const totalPages =
        Math.max(
          1,

          Math.ceil(
            result.total /
            state.pageSize
          )
        );

      if (
        state.page >
        totalPages
      ) {
        state.page =
          totalPages;

        offset =
          (
            state.page - 1
          ) *
          state.pageSize;

        result =
          await executeSearch(
            offset
          );
      }

      if (
        sequence !==
        renderSequence
      ) {
        return;
      }

      /*
       * Search Worker 只回索引資料。
       * Card 本體還沒載入時，
       * 這裡才去抓需要的 Chunk。
       */
      const lazyResult =
        await presetLoader
          .ensureHits(
            result.hits
          );

      if (
        sequence !==
        renderSequence
      ) {
        return;
      }

      const cards =
        result.hits
          .map(
            (hit) => ({
              card:
                registry.getCard(
                  hit.id
                ),

              hit
            })
          )
          .filter(
            (entry) =>
              Boolean(
                entry.card
              )
          );

      refs.initialState.hidden =
        true;

      refs.results.hidden =
        false;

      refs.summary.textContent =
        result.total
          ? `找到 ${result.total.toLocaleString(
              "zh-TW"
            )} 筆，第 ${state.page} / ${totalPages} 頁`
          : createEmptySummary();

      renderCards(
        cards
      );

      renderPagination(
        totalPages
      );

      const status =
        await searchEngine
          .status();

      if (
        sequence !==
        renderSequence
      ) {
        return;
      }

      const lazyText =
        lazyResult.requested
          ? ` · 本頁按需載入 ${lazyResult.fulfilled}/${lazyResult.requested} 個 Chunk`
          : "";

      setSearchStatus(
        `Search Worker · 索引 ${status.documentCount.toLocaleString(
          "zh-TW"
        )} 筆 · Token ${status.tokenCount.toLocaleString(
          "zh-TW"
        )}${lazyText}`,

        "ready"
      );
    } catch (error) {
      console.error(
        "Encyclopedia Search error:",
        error
      );

      setSearchStatus(
        `搜尋失敗：${error.message}`,
        "error"
      );

      refs.summary.textContent =
        "搜尋引擎發生錯誤。";
    }
  }

  function executeSearch(
    offset
  ) {
    return searchEngine.search(
      state.query,
      {
        categories:
          [
            ...state.categories
          ],

        sourceType:
          state.sourceType,

        platform:
          state.platform,

        material:
          state.material,

        gender:
          state.gender,

        sort:
          state.sort,

        offset,

        limit:
          state.pageSize
      }
    );
  }

  /* ========================================
     Facets
  ======================================== */

  async function refreshFacetOptions() {
    if (
      !searchReady
    ) {
      return;
    }

    try {
      const facets =
        await searchEngine
          .getFacets({
            categories:
              [
                ...state.categories
              ]
          });

      replaceFacetOptions(
        refs.material,
        "全部材質",
        facets.materials,
        state.material
      );

      replaceFacetOptions(
        refs.gender,
        "全部性別",
        facets.genders,
        state.gender
      );
    } catch (error) {
      console.error(
        "Facet 更新失敗：",
        error
      );
    }
  }

  /* ========================================
     Rendering
  ======================================== */

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
        )} 張 Card。`;

    refs.initialState.innerHTML = `
      <div class="ency-initial-icon">
        🍮
      </div>

      <h3>
        百科已準備好，但不會自動倒出全部資料卡
      </h3>

      <p>
        選擇左側分類、輸入搜尋內容，
        或按「顯示全部資料卡」後，
        Search Worker 才開始尋找結果。
      </p>
    `;
  }

  function renderSearchLoading() {
    refs.initialState.hidden =
      false;

    refs.results.hidden =
      true;

    refs.pagination.hidden =
      true;

    refs.initialState.innerHTML = `
      <div class="ency-initial-icon">
        ⚡
      </div>

      <h3>
        Search Worker 啟動中
      </h3>

      <p>
        正在建立 Runtime Index。
      </p>
    `;
  }

  function renderCards(
    entries
  ) {
    const fragment =
      document.createDocumentFragment();

    if (!entries.length) {
      const empty =
        document.createElement(
          "div"
        );

      empty.className =
        "ency-initial-state";

      empty.innerHTML = `
        <div class="ency-initial-icon">
          🍮
        </div>

        <h3>
          沒有可顯示的 Card
        </h3>

        <p>
          搜尋索引有結果但 Card Chunk 尚未發布，
          或目前沒有符合條件的資料。
        </p>
      `;

      fragment.append(
        empty
      );
    } else {
      entries.forEach(
        ({
          card,
          hit
        }) => {
          const node =
            cardSystem
              .createCardElement(
                card
              );

          if (
            state.query &&
            hit.score
          ) {
            const badge =
              document.createElement(
                "span"
              );

            badge.className =
              "ency-search-score";

            badge.textContent =
              `相關度 ${Math.round(
                hit.score
              )}`;

            node
              .querySelector(
                ".card-v1-overline"
              )
              ?.append(
                badge
              );
          }

          fragment.append(
            node
          );
        }
      );
    }

    refs.results
      .replaceChildren(
        fragment
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

  function setSearchStatus(
    message,
    status = ""
  ) {
    if (!refs.searchStatus) {
      return;
    }

    refs.searchStatus
      .classList
      .remove(
        "is-ready",
        "is-busy",
        "is-error"
      );

    if (status) {
      refs.searchStatus
        .classList
        .add(
          `is-${status}`
        );
    }

    refs.searchStatus
      .textContent =
        message;
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
    return (
      "沒有符合目前搜尋與篩選條件的資料卡。"
    );
  }

  /* ========================================
     Base UI
  ======================================== */

  function createBaseHtml() {
    return `
      <div class="ency-toolbar">

        <div>
          <div class="panel-kicker">
            ENCYCLOPEDIA SEARCH
          </div>

          <h3>
            百科篩選器
          </h3>

          <p>
            Search Worker + Lazy Loading
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
            全文搜尋
          </span>

          <input
            type="search"
            autocomplete="off"
            data-ency-filter-query
            placeholder="名稱、Prompt、標籤、材質…"
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
              相關度／預設
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
        class="ency-search-status"
        data-ency-search-status
      >
        Search Worker 尚未啟動
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
        aria-label="百科分頁"
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

    ${(
      Array.isArray(values)
        ? values
        : []
    )
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

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}