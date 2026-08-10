"use strict";

import {
  APP,
  MODULES,
  CATEGORY_GROUPS,
  MODULE_PLACEHOLDERS
} from "./core/config.js";

import {
  registry
} from "./core/registry.js";

const state = {
  openModules:
    new Set(),

  activeCategories:
    new Set(),

  registryReady:
    false
};

const dom = {};

boot();

function boot() {
  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );

    return;
  }

  initialize();
}

async function initialize() {
  cacheDom();
  applyAppMetadata();
  renderNavigation();
  renderCategoryTree();
  bindEvents();

  updateStatistics();

  try {
    await initializeRegistry();

    console.info(
      `🍮 ${APP.nameEn} v${APP.version} — Step 02 ready`
    );
  } catch (error) {
    console.error(
      "🍮 Step 02 Registry 初始化失敗：",
      error
    );

    showRegistryError(
      error
    );
  }
}

async function initializeRegistry() {
  registry.subscribe(
    (
      message,
      snapshot
    ) => {
      updateStatistics(
        snapshot
      );

      console.debug(
        "[2Y Registry]",
        message
      );
    }
  );

  const snapshot =
    await registry.init();

  state.registryReady =
    true;

  updateStatistics(
    snapshot
  );

  updateRegistryStatus(
    snapshot
  );

  exposeDebugApi();
}

function exposeDebugApi() {
  /*
   * 只做開發期檢查。
   * 不讓 UI 模組靠這個全域物件互相傳資料。
   */
  window.TWO_Y_V1 =
    Object.freeze({
      version:
        APP.version,

      registry
    });
}

function cacheDom() {
  dom.topNavigation =
    document.querySelector(
      "#topNavigation"
    );

  dom.categoryTree =
    document.querySelector(
      "#categoryTree"
    );

  dom.beforeBuilderZone =
    document.querySelector(
      "#beforeBuilderZone"
    );

  dom.afterBuilderZone =
    document.querySelector(
      "#afterBuilderZone"
    );

  dom.promptBuilderZone =
    document.querySelector(
      "#promptBuilderZone"
    );

  dom.sidebar =
    document.querySelector(
      "#sidebar"
    );

  dom.globalSearch =
    document.querySelector(
      "#globalSearch"
    );

  dom.menuButton =
    document.querySelector(
      "#menuButton"
    );

  dom.sidebarButton =
    document.querySelector(
      "#sidebarButton"
    );

  dom.promptDockButton =
    document.querySelector(
      "#promptDockButton"
    );

  dom.promptDockCount =
    document.querySelector(
      "#promptDockCount"
    );
}

function applyAppMetadata() {
  document.title =
    `${APP.nameZh}｜${APP.nameEn}`;

  document
    .querySelectorAll(
      "[data-app-version]"
    )
    .forEach(
      (element) => {
        element.textContent =
          `v${APP.version}`;
      }
    );

  document
    .querySelectorAll(
      "[data-app-name-zh]"
    )
    .forEach(
      (element) => {
        element.textContent =
          APP.nameZh;
      }
    );

  document
    .querySelectorAll(
      "[data-preset-target]"
    )
    .forEach(
      (element) => {
        element.textContent =
          APP.presetTarget
            .toLocaleString(
              "zh-TW"
            );
      }
    );

  document.documentElement
    .dataset.appVersion =
      APP.version;
}

function renderNavigation() {
  dom.topNavigation.innerHTML = `
    <button
      class="nav-button is-active"
      type="button"
      data-home
    >
      🏠 首頁
    </button>

    ${MODULES.map(
      (module) => `
        <button
          class="nav-button"
          type="button"
          data-module="${escapeHtml(
            module.id
          )}"
        >
          ${module.icon}
          ${escapeHtml(
            module.label
          )}
        </button>
      `
    ).join("")}
  `;
}

function renderCategoryTree() {
  dom.categoryTree.innerHTML =
    CATEGORY_GROUPS.map(
      (
        group,
        index
      ) => `
        <details
          class="category-group"
          ${
            index < 2
              ? "open"
              : ""
          }
        >
          <summary>
            <span>
              ${group.icon}
            </span>

            <strong>
              ${escapeHtml(
                group.label
              )}
            </strong>
          </summary>

          <div
            class="category-items"
          >
            ${group.categories
              .map(
                (category) => `
                  <button
                    class="category-button"
                    type="button"
                    data-category="${escapeHtml(
                      category
                    )}"
                  >
                    ${escapeHtml(
                      category
                    )}
                  </button>
                `
              )
              .join("")}
          </div>
        </details>
      `
    ).join("");
}

function bindEvents() {
  document.addEventListener(
    "click",
    handleDocumentClick
  );

  dom.globalSearch
    ?.addEventListener(
      "input",
      handleSearchInput
    );

  dom.menuButton
    ?.addEventListener(
      "click",
      () => {
        dom.topNavigation
          .classList
          .toggle(
            "is-open"
          );
      }
    );

  dom.sidebarButton
    ?.addEventListener(
      "click",
      () => {
        dom.sidebar
          .classList
          .toggle(
            "is-open"
          );
      }
    );

  dom.promptDockButton
    ?.addEventListener(
      "click",
      () => {
        toggleModule(
          "prompt-builder"
        );
      }
    );
}

function handleDocumentClick(
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

  const homeButton =
    target.closest(
      "[data-home]"
    );

  if (homeButton) {
    goHome();
    return;
  }

  const moduleButton =
    target.closest(
      "[data-module]"
    );

  if (moduleButton) {
    toggleModule(
      moduleButton
        .dataset
        .module
    );

    return;
  }

  const categoryButton =
    target.closest(
      "[data-category]"
    );

  if (categoryButton) {
    toggleCategory(
      categoryButton
        .dataset
        .category
    );

    return;
  }

  const closeButton =
    target.closest(
      "[data-close-module]"
    );

  if (closeButton) {
    closeModule(
      closeButton
        .dataset
        .closeModule
    );
  }
}

function goHome() {
  state.openModules
    .clear();

  state.activeCategories
    .clear();

  renderOpenModules();
  updateNavigation();
  updateCategoryButtons();

  dom.topNavigation
    .classList
    .remove(
      "is-open"
    );

  dom.sidebar
    .classList
    .remove(
      "is-open"
    );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function toggleModule(
  moduleId
) {
  const module =
    MODULES.find(
      (item) =>
        item.id ===
        moduleId
    );

  if (!module) {
    return;
  }

  if (
    state.openModules
      .has(moduleId)
  ) {
    state.openModules
      .delete(
        moduleId
      );
  } else {
    state.openModules
      .add(
        moduleId
      );
  }

  renderOpenModules();
  updateNavigation();

  dom.topNavigation
    .classList
    .remove(
      "is-open"
    );

  window
    .requestAnimationFrame(
      () => {
        document
          .querySelector(
            `[data-module-panel="${cssEscape(
              moduleId
            )}"]`
          )
          ?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "nearest"
          });
      }
    );
}

function closeModule(
  moduleId
) {
  state.openModules
    .delete(
      moduleId
    );

  renderOpenModules();
  updateNavigation();
}

function toggleCategory(
  categoryLabel
) {
  const categoryId =
    registry.resolveCategory(
      categoryLabel
    );

  /*
   * Step 02 已開始使用穩定 Category ID。
   * Registry 尚未完成時才暫時使用文字。
   */
  const categoryKey =
    categoryId ||
    categoryLabel;

  if (
    state.activeCategories
      .has(categoryKey)
  ) {
    state.activeCategories
      .delete(
        categoryKey
      );
  } else {
    state.activeCategories
      .add(
        categoryKey
      );
  }

  state.openModules
    .add(
      "encyclopedia"
    );

  renderOpenModules();
  updateNavigation();
  updateCategoryButtons();

  dom.sidebar
    .classList
    .remove(
      "is-open"
    );

  renderEncyclopediaPlaceholder();
}

function renderEncyclopediaPlaceholder() {
  const placeholder =
    document.querySelector(
      '[data-module-panel="encyclopedia"] .module-placeholder'
    );

  if (!placeholder) {
    return;
  }

  const selected =
    [
      ...state.activeCategories
    ];

  const labels =
    selected.map(
      (categoryId) => {
        return (
          registry.getCategory(
            categoryId
          )?.nameZh ||
          categoryId
        );
      }
    );

  placeholder.innerHTML = `
    <span
      class="module-status"
    >
      STEP 02
    </span>

    <h3>
      Registry 已接管分類
    </h3>

    <p>
      ${
        labels.length
          ? labels
              .map(
                (item) =>
                  `「${escapeHtml(
                    item
                  )}」`
              )
              .join("＋")
          : "尚未選擇分類"
      }
    </p>

    <p>
      目前分類已不再依賴中文名稱作為資料 ID。
      真正百科資料瀏覽會在 Step 03 接上。
    </p>
  `;
}

function handleSearchInput(
  event
) {
  const query =
    event.target
      .value
      .trim();

  if (!query) {
    return;
  }

  state.openModules
    .add(
      "encyclopedia"
    );

  renderOpenModules();
  updateNavigation();

  const placeholder =
    document.querySelector(
      '[data-module-panel="encyclopedia"] .module-placeholder'
    );

  if (placeholder) {
    placeholder.innerHTML = `
      <span
        class="module-status"
      >
        SEARCH PLACEHOLDER
      </span>

      <h3>
        搜尋：
        ${escapeHtml(
          query
        )}
      </h3>

      <p>
        Step 02 只完成資料架構。
        真正全文索引仍會在 Step 05 製作。
      </p>
    `;
  }
}

function renderOpenModules() {
  const beforeModules =
    MODULES.filter(
      (module) =>
        module.area ===
          "before" &&
        state.openModules
          .has(
            module.id
          )
    );

  const builderModules =
    MODULES.filter(
      (module) =>
        module.area ===
          "builder" &&
        state.openModules
          .has(
            module.id
          )
    );

  const afterModules =
    MODULES.filter(
      (module) =>
        module.area ===
          "after" &&
        state.openModules
          .has(
            module.id
          )
    );

  dom.beforeBuilderZone
    .innerHTML =
      beforeModules
        .map(
          createModulePanel
        )
        .join("");

  dom.promptBuilderZone
    .innerHTML =
      builderModules
        .map(
          createModulePanel
        )
        .join("");

  dom.afterBuilderZone
    .innerHTML =
      afterModules
        .map(
          createModulePanel
        )
        .join("");
}

function createModulePanel(
  module
) {
  return `
    <section
      class="panel module-panel"
      data-module-panel="${escapeHtml(
        module.id
      )}"
    >
      <div
        class="panel-inner"
      >
        <div
          class="module-panel-header"
        >
          <div>
            <div
              class="panel-kicker"
            >
              ${escapeHtml(
                module.id
              )}
            </div>

            <h2>
              ${module.icon}
              ${escapeHtml(
                module.label
              )}
            </h2>
          </div>

          <button
            class="module-close"
            type="button"
            data-close-module="${escapeHtml(
              module.id
            )}"
            aria-label="關閉 ${escapeHtml(
              module.label
            )}"
          >
            ×
          </button>
        </div>

        <div
          class="module-placeholder"
        >
          <span
            class="module-status"
          >
            STEP 02
          </span>

          <p>
            ${escapeHtml(
              MODULE_PLACEHOLDERS[
                module.id
              ] ??
              "模組入口已建立。"
            )}
          </p>
        </div>
      </div>
    </section>
  `;
}

function updateNavigation() {
  document
    .querySelectorAll(
      "[data-module]"
    )
    .forEach(
      (button) => {
        button
          .classList
          .toggle(
            "is-active",

            state
              .openModules
              .has(
                button
                  .dataset
                  .module
              )
          );
      }
    );

  const homeButton =
    document.querySelector(
      "[data-home]"
    );

  homeButton
    ?.classList
    .toggle(
      "is-active",
      state.openModules
        .size === 0
    );
}

function updateCategoryButtons() {
  document
    .querySelectorAll(
      "[data-category]"
    )
    .forEach(
      (button) => {
        const categoryId =
          registry
            .resolveCategory(
              button
                .dataset
                .category
            );

        const key =
          categoryId ||
          button
            .dataset
            .category;

        button
          .classList
          .toggle(
            "is-active",

            state
              .activeCategories
              .has(key)
          );
      }
    );
}

function updateStatistics(
  snapshot =
    registry.ready
      ? registry.snapshot()
      : null
) {
  const counts =
    snapshot?.counts || {
      official: 0,
      custom: 0,
      external: 0,
      target:
        APP.presetTarget
    };

  setText(
    "#statOfficial",
    `${counts.official.toLocaleString(
      "zh-TW"
    )} / ${counts.target.toLocaleString(
      "zh-TW"
    )}`
  );

  setText(
    "#statCustom",
    counts.custom
      .toLocaleString(
        "zh-TW"
      )
  );

  setText(
    "#statExternal",
    counts.external
      .toLocaleString(
        "zh-TW"
      )
  );

  setText(
    "#statFavorites",
    "0"
  );

  setText(
    "#statVersion",
    `v${APP.version}`
  );

  if (
    dom.promptDockCount
  ) {
    dom.promptDockCount
      .textContent =
        "已加入 0 項";
  }
}

function updateRegistryStatus(
  snapshot
) {
  document.documentElement
    .dataset.registryReady =
      "true";

  document.documentElement
    .dataset.officialCards =
      String(
        snapshot
          .counts
          .official
      );

  document.documentElement
    .dataset.customCards =
      String(
        snapshot
          .counts
          .custom
      );

  document.documentElement
    .dataset.externalCards =
      String(
        snapshot
          .counts
          .external
      );
}

function showRegistryError(
  error
) {
  document.documentElement
    .dataset.registryReady =
      "false";

  const home =
    document.querySelector(
      "#home"
    );

  if (!home) {
    return;
  }

  const panel =
    document.createElement(
      "article"
    );

  panel.className =
    "panel";

  panel.innerHTML = `
    <div
      class="panel-inner"
    >
      <div
        class="panel-kicker"
      >
        REGISTRY ERROR
      </div>

      <h2>
        ⚠️ Data Registry 載入失敗
      </h2>

      <p>
        ${escapeHtml(
          error?.message ||
          String(error)
        )}
      </p>

      <p>
        請確認 taxonomy.json、
        manifest.json 與
        card.schema.json 的路徑與 JSON 格式。
      </p>
    </div>
  `;

  home.append(panel);
}

function setText(
  selector,
  value
) {
  const element =
    document.querySelector(
      selector
    );

  if (element) {
    element.textContent =
      value;
  }
}

function cssEscape(
  value
) {
  if (
    window.CSS
      ?.escape
  ) {
    return CSS.escape(
      value
    );
  }

  return String(value)
    .replaceAll(
      '"',
      '\\"'
    );
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