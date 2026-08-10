"use strict";

/*
 * 2Y AI Prompt Encyclopedia
 * Encyclopedia Module
 * Step 03
 * App Version: 1.0.0
 *
 * 規則：
 * - Encyclopedia 只管理自己的 DOM。
 * - Filter / Page 改變可以重畫結果區。
 * - Card variant 改變只更新該 Card。
 * - Registry 更新遇到 Card select 正在操作時延後。
 */

const PLATFORM_LABELS = Object.freeze({
  pixai: "PixAI",
  niji: "Niji",
  tensorart: "TensorArt",
  "gpt-image": "GPT Image"
});

const ATTRIBUTE_LABELS = Object.freeze({
  material: "材質",
  fit: "版型",
  length: "長度",
  sleeve: "袖型",
  neckline: "領口",
  gender: "性別"
});

const SOURCE_LABELS = Object.freeze({
  official: "官方預設",
  custom: "自訂資料",
  external: "外掛資料"
});

export function createEncyclopediaController({
  registry,
  onCategoriesChange = () => {},
  onQueryChange = () => {}
}) {
  const state = {
    activated: false,
    showAllExplicit: false,

    categories: new Set(),

    query: "",

    sourceType: "all",
    platform: "all",
    material: "all",
    gender: "all",

    sort: "default",
    pageSize: 12,
    page: 1
  };

  const cardSelections = new Map();

  let host = null;
  let refs = {};

  let unsubscribeRegistry = null;

  let cardControlActive = false;
  let pendingRegistryRefresh = false;

  function mount(target) {
    host = target;

    host.innerHTML = createBaseHtml();

    cacheRefs();
    bindEvents();

    refreshFacetOptions();
    render();

    unsubscribeRegistry = registry.subscribe(
      (message) => {
        if (
          ![
            "cards-updated",
            "card-removed",
            "source-cards-removed",
            "source-status-changed",
            "source-registered",
            "source-unregistered"
          ].includes(message.type)
        ) {
          return;
        }

        if (cardControlActive) {
          pendingRegistryRefresh = true;
          return;
        }

        refreshFacetOptions();
        render();
      }
    );
  }

  function destroy() {
    unsubscribeRegistry?.();

    unsubscribeRegistry = null;

    if (host) {
      host.replaceChildren();
    }

    host = null;
    refs = {};
  }

  function cacheRefs() {
    refs.query =
      host.querySelector("[data-ency-filter-query]");

    refs.source =
      host.querySelector("[data-ency-filter-source]");

    refs.platform =
      host.querySelector("[data-ency-filter-platform]");

    refs.material =
      host.querySelector("[data-ency-filter-material]");

    refs.gender =
      host.querySelector("[data-ency-filter-gender]");

    refs.sort =
      host.querySelector("[data-ency-filter-sort]");

    refs.pageSize =
      host.querySelector("[data-ency-filter-page-size]");

    refs.categoryChips =
      host.querySelector("[data-ency-category-chips]");

    refs.summary =
      host.querySelector("[data-ency-summary]");

    refs.results =
      host.querySelector("[data-ency-results]");

    refs.pagination =
      host.querySelector("[data-ency-pagination]");

    refs.initialState =
      host.querySelector("[data-ency-initial-state]");
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

  function handleFocusIn(event) {
    const target = event.target;

    if (
      target.matches?.(
        "[data-card-colorway], [data-card-attribute]"
      )
    ) {
      cardControlActive = true;
    }
  }

  function handleFocusOut(event) {
    const target = event.target;

    if (
      !target.matches?.(
        "[data-card-colorway], [data-card-attribute]"
      )
    ) {
      return;
    }

    window.setTimeout(
      () => {
        const active =
          document.activeElement;

        if (
          active?.matches?.(
            "[data-card-colorway], [data-card-attribute]"
          )
        ) {
          return;
        }

        cardControlActive = false;

        if (pendingRegistryRefresh) {
          pendingRegistryRefresh = false;

          refreshFacetOptions();
          render();
        }
      },
      180
    );
  }

  function handleInput(event) {
    if (
      event.target !== refs.query
    ) {
      return;
    }

    state.query =
      event.target.value.trim();

    state.page = 1;

    if (state.query) {
      state.activated = true;
    }

    onQueryChange(state.query);

    render();
  }

  function handleChange(event) {
    const target = event.target;

    /*
     * Card control：
     * 絕對不可呼叫 render()。
     */
    if (
      target.matches?.(
        "[data-card-colorway], [data-card-attribute]"
      )
    ) {
      updateCardSelection(target);
      return;
    }

    if (target === refs.source) {
      state.sourceType =
        target.value;
    }

    if (target === refs.platform) {
      state.platform =
        target.value;
    }

    if (target === refs.material) {
      state.material =
        target.value;
    }

    if (target === refs.gender) {
      state.gender =
        target.value;
    }

    if (target === refs.sort) {
      state.sort =
        target.value;
    }

    if (target === refs.pageSize) {
      state.pageSize =
        Number(target.value) || 12;
    }

    state.page = 1;

    if (
      target.matches?.(
        "[data-ency-filter-source], " +
        "[data-ency-filter-platform], " +
        "[data-ency-filter-material], " +
        "[data-ency-filter-gender]"
      )
    ) {
      state.activated = true;
    }

    render();
  }

  function handleClick(event) {
    const target =
      event.target instanceof Element
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

    const removeCategory =
      target.closest(
        "[data-ency-remove-category]"
      );

    if (removeCategory) {
      removeCategoryFilter(
        removeCategory.dataset
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

      return;
    }

    const copyButton =
      target.closest(
        "[data-card-copy]"
      );

    if (copyButton) {
      copyCardContent(copyButton);
    }
  }

  function setCategories(
    categories
  ) {
    state.categories =
      new Set(
        categories
          .map((value) =>
            registry.resolveCategory(value)
          )
          .filter(Boolean)
      );

    if (state.categories.size) {
      state.showAllExplicit = false;
      state.activated = true;
    } else if (
      !state.query &&
      !state.showAllExplicit
    ) {
      state.activated = false;
    }

    state.page = 1;

    render();
  }

  function setQuery(query) {
    state.query =
      String(query || "").trim();

    if (refs.query) {
      refs.query.value =
        state.query;
    }

    if (state.query) {
      state.activated = true;
    } else if (
      !state.categories.size &&
      !state.showAllExplicit
    ) {
      state.activated = false;
    }

    state.page = 1;

    render();
  }

  function showAll() {
    state.categories.clear();

    state.showAllExplicit = true;
    state.activated = true;
    state.page = 1;

    onCategoriesChange([]);

    render();
  }

  function clear() {
    state.activated = false;
    state.showAllExplicit = false;

    state.categories.clear();

    state.query = "";

    state.sourceType = "all";
    state.platform = "all";
    state.material = "all";
    state.gender = "all";

    state.sort = "default";
    state.pageSize = 12;
    state.page = 1;

    onCategoriesChange([]);
    onQueryChange("");

    syncControls();
    render();
  }

  function removeCategoryFilter(
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
      state.activated = false;
    }

    onCategoriesChange(
      [...state.categories]
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

    const all =
      getFilteredCards();

    const total =
      all.length;

    const pageSize =
      state.pageSize;

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          total / pageSize
        )
      );

    state.page =
      Math.min(
        Math.max(
          state.page,
          1
        ),
        totalPages
      );

    const start =
      (state.page - 1) *
      pageSize;

    const cards =
      all.slice(
        start,
        start + pageSize
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

    renderCards(cards);

    renderPagination(
      totalPages
    );
  }

  function renderInitialState() {
    refs.results.hidden =
      true;

    refs.results.replaceChildren();

    refs.pagination.hidden =
      true;

    refs.pagination.replaceChildren();

    refs.initialState.hidden =
      false;

    refs.summary.textContent =
      `Registry 已連線，目前載入 ${registry
        .getCounts()
        .total.toLocaleString(
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
        從左側選擇一個或多個分類、
        使用搜尋，或按「顯示全部資料卡」。
      </p>
    `;
  }

  function getFilteredCards() {
    let cards =
      registry.getCards({
        enabledOnly: true
      });

    const query =
      state.query
        .toLowerCase();

    cards =
      cards.filter(
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
            state.sourceType !== "all" &&
            card.source?.type !==
              state.sourceType
          ) {
            return false;
          }

          if (
            state.platform !== "all" &&
            !card.platforms.includes(
              state.platform
            )
          ) {
            return false;
          }

          if (
            state.material !== "all" &&
            !hasAttributeValue(
              card,
              "material",
              state.material
            )
          ) {
            return false;
          }

          if (
            state.gender !== "all" &&
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
            !createSearchText(card)
              .includes(query)
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
    const collatorZh =
      new Intl.Collator(
        "zh-Hant"
      );

    const collatorEn =
      new Intl.Collator(
        "en"
      );

    if (
      state.sort ===
      "name-zh"
    ) {
      cards.sort(
        (a, b) =>
          collatorZh.compare(
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
          collatorEn.compare(
            a.nameEn,
            b.nameEn
          )
      );

      return;
    }

    if (
      state.sort ===
      "category"
    ) {
      cards.sort(
        (a, b) =>
          collatorZh.compare(
            getCategoryName(
              a.category
            ),
            getCategoryName(
              b.category
            )
          ) ||
          collatorZh.compare(
            a.nameZh,
            b.nameZh
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
            b.metadata?.updatedAt
          ) -
          dateValue(
            a.metadata?.updatedAt
          )
      );

      return;
    }

    cards.sort(
      (a, b) =>
        collatorZh.compare(
          getCategoryName(
            a.category
          ),
          getCategoryName(
            b.category
          )
        ) ||
        collatorZh.compare(
          a.nameZh,
          b.nameZh
        )
    );
  }

  function renderCards(cards) {
    const fragment =
      document.createDocumentFragment();

    cards.forEach(
      (card) => {
        fragment.append(
          createCardElement(card)
        );
      }
    );

    refs.results.replaceChildren(
      fragment
    );
  }

  function createCardElement(
    card
  ) {
    const selection =
      ensureCardSelection(card);

    const colorway =
      getSelectedColorway(
        card,
        selection
      );

    const article =
      document.createElement(
        "article"
      );

    article.className =
      "ency-card";

    article.dataset.cardId =
      card.id;

    article.style.setProperty(
      "--ency-card-accent",
      colorway?.palette?.[0]
        ?.hex ||
        "#C400FF"
    );

    article.innerHTML = `
      <div class="ency-card-accent"></div>

      <div class="ency-card-inner">

        <header class="ency-card-header">

          <div>
            <div class="ency-card-category">
              ${escapeHtml(
                getCategoryName(
                  card.category
                )
              )}
            </div>

            <h3>
              ${escapeHtml(
                card.nameZh
              )}
            </h3>

            <p class="ency-card-en">
              ${escapeHtml(
                card.nameEn
              )}
            </p>
          </div>

          <div class="ency-card-header-actions">

            <span class="ency-source-badge">
              ${escapeHtml(
                SOURCE_LABELS[
                  card.source?.type
                ] ||
                card.source?.type ||
                "未知來源"
              )}
            </span>

            <button
              class="ency-pudding-button"
              type="button"
              disabled
              title="收藏將於 Step 06 啟用"
            >
              🍮
            </button>

          </div>

        </header>

        ${
          card.descriptionZh
            ? `
              <p class="ency-card-description">
                ${escapeHtml(
                  card.descriptionZh
                )}
              </p>
            `
            : ""
        }

        <div class="ency-platforms">
          ${card.platforms
            .map(
              (platform) => `
                <span>
                  ${escapeHtml(
                    PLATFORM_LABELS[
                      platform
                    ] ||
                    platform
                  )}
                </span>
              `
            )
            .join("")}
        </div>

        ${createColorwayHtml(
          card,
          selection
        )}

        ${createAttributesHtml(
          card,
          selection
        )}

        <div class="ency-tags">
          ${card.tags
            .slice(0, 18)
            .map(
              (tag) => `
                <span>
                  ${escapeHtml(
                    tag
                  )}
                </span>
              `
            )
            .join("")}
        </div>

        <section class="ency-prompt-box">
          <div class="ency-prompt-title">
            <strong>
              Prompt
            </strong>

            <button
              type="button"
              data-card-copy="positive"
            >
              複製
            </button>
          </div>

          <p data-card-positive>
            ${escapeHtml(
              buildPositivePrompt(
                card,
                selection
              )
            )}
          </p>
        </section>

        <section
          class="ency-prompt-box
                 ency-negative-box"
        >
          <div class="ency-prompt-title">
            <strong>
              Negative Prompt
            </strong>

            <button
              type="button"
              data-card-copy="negative"
            >
              複製
            </button>
          </div>

          <p data-card-negative>
            ${escapeHtml(
              buildNegativePrompt(
                card
              )
            )}
          </p>
        </section>

        <footer class="ency-card-footer">
          <small>
            ID：
            ${escapeHtml(
              card.id
            )}
          </small>

          <button
            type="button"
            disabled
            title="Prompt Builder 於 Step 07 啟用"
          >
            ＋ 加入提示詞組合器
          </button>
        </footer>

      </div>
    `;

    return article;
  }

  function createColorwayHtml(
    card,
    selection
  ) {
    if (
      !Array.isArray(
        card.colorways
      ) ||
      !card.colorways.length
    ) {
      return "";
    }

    const selected =
      getSelectedColorway(
        card,
        selection
      );

    return `
      <section class="ency-card-section">

        <div class="ency-section-label">
          命名配色
        </div>

        <select
          data-card-colorway
          data-card-id="${escapeHtml(
            card.id
          )}"
        >
          ${card.colorways
            .map(
              (colorway) => `
                <option
                  value="${escapeHtml(
                    colorway.id
                  )}"
                  ${
                    colorway.id ===
                    selection.colorwayId
                      ? "selected"
                      : ""
                  }
                >
                  ${escapeHtml(
                    colorway.nameZh
                  )}
                  ${
                    colorway.nameEn
                      ? ` · ${escapeHtml(
                          colorway.nameEn
                        )}`
                      : ""
                  }
                </option>
              `
            )
            .join("")}
        </select>

        <div
          class="ency-colorway-name"
          data-card-colorway-name
        >
          ${escapeHtml(
            selected?.nameZh ||
            ""
          )}
        </div>

        <div
          class="ency-swatches"
          data-card-swatches
        >
          ${createSwatchesHtml(
            selected
          )}
        </div>

      </section>
    `;
  }

  function createAttributesHtml(
    card,
    selection
  ) {
    const available =
      Object.entries(
        ATTRIBUTE_LABELS
      ).filter(
        ([attributeId]) =>
          Array.isArray(
            card.attributes?.[
              attributeId
            ]
          ) &&
          card.attributes[
            attributeId
          ].length
      );

    if (!available.length) {
      return "";
    }

    return `
      <section class="ency-attribute-grid">

        ${available
          .map(
            ([
              attributeId,
              label
            ]) => {
              const options =
                card.attributes[
                  attributeId
                ];

              const selected =
                selection.attributes[
                  attributeId
                ];

              return `
                <label>
                  <span>
                    ${escapeHtml(
                      label
                    )}
                  </span>

                  <select
                    data-card-attribute
                    data-card-id="${escapeHtml(
                      card.id
                    )}"
                    data-attribute-id="${escapeHtml(
                      attributeId
                    )}"
                  >
                    ${options
                      .map(
                        (
                          option,
                          index
                        ) => `
                          <option
                            value="${escapeHtml(
                              option.id
                            )}"
                            ${
                              option.id ===
                              selected ||
                              (
                                !selected &&
                                index === 0
                              )
                                ? "selected"
                                : ""
                            }
                          >
                            ${escapeHtml(
                              option.nameZh ||
                              option.nameEn ||
                              option.id
                            )}
                          </option>
                        `
                      )
                      .join("")}
                  </select>
                </label>
              `;
            }
          )
          .join("")}

      </section>
    `;
  }

  function ensureCardSelection(
    card
  ) {
    if (
      !cardSelections.has(
        card.id
      )
    ) {
      const attributes = {};

      Object.entries(
        ATTRIBUTE_LABELS
      ).forEach(
        ([attributeId]) => {
          attributes[
            attributeId
          ] =
            card.attributes?.[
              attributeId
            ]?.[0]?.id ||
            "";
        }
      );

      cardSelections.set(
        card.id,
        {
          colorwayId:
            card.colorways?.[0]
              ?.id ||
            "",

          attributes
        }
      );
    }

    return cardSelections.get(
      card.id
    );
  }

  function updateCardSelection(
    select
  ) {
    const cardId =
      select.dataset.cardId;

    const card =
      registry.getCard(
        cardId
      );

    if (!card) {
      return;
    }

    const selection =
      ensureCardSelection(
        card
      );

    if (
      select.matches(
        "[data-card-colorway]"
      )
    ) {
      selection.colorwayId =
        select.value;
    }

    if (
      select.matches(
        "[data-card-attribute]"
      )
    ) {
      const attributeId =
        select.dataset
          .attributeId;

      selection.attributes[
        attributeId
      ] =
        select.value;
    }

    const cardElement =
      select.closest(
        ".ency-card"
      );

    if (!cardElement) {
      return;
    }

    /*
     * 這裡是 Step 03 最重要的一條：
     * 不呼叫 render()。
     */
    updateSingleCard(
      cardElement,
      card,
      selection
    );
  }

  function updateSingleCard(
    cardElement,
    card,
    selection
  ) {
    const colorway =
      getSelectedColorway(
        card,
        selection
      );

    cardElement.style.setProperty(
      "--ency-card-accent",
      colorway?.palette?.[0]
        ?.hex ||
        "#C400FF"
    );

    const colorwayName =
      cardElement.querySelector(
        "[data-card-colorway-name]"
      );

    if (colorwayName) {
      colorwayName.textContent =
        colorway?.nameZh ||
        "";
    }

    const swatches =
      cardElement.querySelector(
        "[data-card-swatches]"
      );

    if (swatches) {
      swatches.innerHTML =
        createSwatchesHtml(
          colorway
        );
    }

    const prompt =
      cardElement.querySelector(
        "[data-card-positive]"
      );

    if (prompt) {
      prompt.textContent =
        buildPositivePrompt(
          card,
          selection
        );
    }

    cardElement.classList.add(
      "is-variant-updated"
    );

    window.setTimeout(
      () => {
        cardElement.classList.remove(
          "is-variant-updated"
        );
      },
      320
    );
  }

  function getSelectedColorway(
    card,
    selection
  ) {
    return (
      card.colorways?.find(
        (colorway) =>
          colorway.id ===
          selection.colorwayId
      ) ||
      card.colorways?.[0] ||
      null
    );
  }

  function buildPositivePrompt(
    card,
    selection
  ) {
    const fragments = [
      ...(card.prompt?.positive || [])
    ];

    const colorway =
      getSelectedColorway(
        card,
        selection
      );

    fragments.push(
      ...(
        colorway?.prompt ||
        []
      )
    );

    Object.entries(
      selection.attributes
    ).forEach(
      ([
        attributeId,
        optionId
      ]) => {
        const option =
          card.attributes?.[
            attributeId
          ]?.find(
            (candidate) =>
              candidate.id ===
              optionId
          );

        if (option?.prompt) {
          fragments.push(
            option.prompt
          );
        }
      }
    );

    return uniqueFragments(
      fragments
    ).join(", ");
  }

  function buildNegativePrompt(
    card
  ) {
    return uniqueFragments(
      card.prompt?.negative ||
      []
    ).join(", ");
  }

  async function copyCardContent(
    button
  ) {
    const cardElement =
      button.closest(
        ".ency-card"
      );

    if (!cardElement) {
      return;
    }

    const type =
      button.dataset
        .cardCopy;

    const target =
      type === "negative"
        ? cardElement.querySelector(
            "[data-card-negative]"
          )
        : cardElement.querySelector(
            "[data-card-positive]"
          );

    const text =
      target?.textContent
        ?.trim() ||
      "";

    if (!text) {
      return;
    }

    try {
      await navigator.clipboard
        .writeText(text);

      const original =
        button.textContent;

      button.textContent =
        "已複製 ✓";

      window.setTimeout(
        () => {
          button.textContent =
            original;
        },
        900
      );
    } catch {
      window.prompt(
        "請手動複製：",
        text
      );
    }
  }

  function renderCategoryChips() {
    if (
      !state.categories.size
    ) {
      refs.categoryChips.innerHTML = `
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

    refs.categoryChips.innerHTML =
      [...state.categories]
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

      refs.pagination.replaceChildren();

      return;
    }

    refs.pagination.hidden =
      false;

    const pages =
      getPageNumbers(
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
        ← 上一頁
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
        下一頁 →
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

    setSelectValue(
      refs.source,
      state.sourceType
    );

    setSelectValue(
      refs.platform,
      state.platform
    );

    setSelectValue(
      refs.material,
      state.material
    );

    setSelectValue(
      refs.gender,
      state.gender
    );

    setSelectValue(
      refs.sort,
      state.sort
    );

    setSelectValue(
      refs.pageSize,
      String(
        state.pageSize
      )
    );
  }

  function createEmptySummary() {
    const counts =
      registry.getCounts();

    if (!counts.total) {
      return (
        "Registry 正常，目前尚未載入任何正式資料卡。"
      );
    }

    return (
      "沒有符合目前篩選條件的資料卡。"
    );
  }

  function getCategoryName(
    categoryId
  ) {
    return (
      registry.getCategory(
        categoryId
      )?.nameZh ||
      categoryId
    );
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
            初始狀態不顯示全部資料卡。
            選擇分類或搜尋後才載入結果。
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
            placeholder="名稱、標籤、Prompt…"
            data-ency-filter-query
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

    isActivated() {
      return state.activated;
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
  const map =
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
              option.id ||
              ""
            ).trim();

          if (!label) {
            return;
          }

          const key =
            label.toLowerCase();

          if (!map.has(key)) {
            map.set(
              key,
              label
            );
          }
        }
      );
    }
  );

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

  select.value =
    values.includes(selected)
      ? selected
      : "all";
}

function setSelectValue(
  select,
  value
) {
  if (!select) {
    return;
  }

  const exists =
    [...select.options]
      .some(
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
  expected
) {
  const target =
    String(expected)
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

    ...Object.values(
      card.attributes || {}
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

function createSwatchesHtml(
  colorway
) {
  return (
    colorway?.palette ||
    []
  )
    .map(
      (color) => `
        <span
          class="ency-swatch"
          title="${escapeHtml(
            color.nameZh ||
            color.nameEn
          )}"
        >
          <i
            style="background:${safeHex(
              color.hex
            )}"
          ></i>

          <b>
            ${escapeHtml(
              color.nameZh ||
              color.nameEn
            )}
          </b>
        </span>
      `
    )
    .join("");
}

function uniqueFragments(
  values
) {
  const output = [];
  const seen = new Set();

  values
    .map(
      (value) =>
        String(value || "")
          .trim()
    )
    .filter(Boolean)
    .forEach(
      (value) => {
        const key =
          value.toLowerCase();

        if (seen.has(key)) {
          return;
        }

        seen.add(key);
        output.push(value);
      }
    );

  return output;
}

function getPageNumbers(
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

  const pages = [];

  for (
    let page = start;
    page <= end;
    page += 1
  ) {
    pages.push(page);
  }

  return pages;
}

function dateValue(
  value
) {
  const timestamp =
    new Date(
      value || 0
    ).getTime();

  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : 0;
}

function safeHex(
  value
) {
  const text =
    String(value || "");

  return /^#[0-9a-f]{6}$/i
    .test(text)
      ? text
      : "#777777";
}

function escapeHtml(
  value
) {
  return String(value ?? "")
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