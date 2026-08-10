"use strict";

import {
  APP,
  MODULES,
  MODULE_PLACEHOLDERS
} from "./core/config.js";

import {
  registry
} from "./core/registry.js";

import {
  createEncyclopediaController
} from "./modules/encyclopedia.js";

const state = {
  openModules:
    new Set(),

  activeCategories:
    new Set(),

  registryReady:
    false
};

const dom = {};

const moduleNodes =
  new Map();

const moduleControllers =
  new Map();

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

  renderCategoryLoading();

  bindEvents();

  updateStatistics();

  try {
    await initializeRegistry();

    renderCategoryTree();

    console.info(
      `🍮 ${APP.nameEn} v${APP.version} — Step 03 ready`
    );
  } catch (error) {
    console.error(
      "🍮 Registry 初始化失敗：",
      error
    );

    showRegistryError(
      error
    );
  }
}

/* ============================================
   Registry
============================================ */

async function initializeRegistry() {
  registry.subscribe(
    (
      message,
      snapshot
    ) => {
      updateStatistics(
        snapshot
      );

      updateCategoryCounts(
        snapshot.counts
          .categories
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
  window.TWO_Y_V1 =
    Object.freeze({
      version:
        APP.version,

      registry
    });
}

/* ============================================
   DOM
============================================ */

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

  dom.promptBuilderZone =
    document.querySelector(
      "#promptBuilderZone"
    );

  dom.afterBuilderZone =
    document.querySelector(
      "#afterBuilderZone"
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

  document.documentElement
    .dataset.appVersion =
      APP.version;
}

/* ============================================
   Navigation
============================================ */

function renderNavigation() {
  const fragment =
    document.createDocumentFragment();

  const homeButton =
    document.createElement(
      "button"
    );

  homeButton.type =
    "button";

  homeButton.className =
    "nav-button is-active";

  homeButton.dataset.home =
    "";

  homeButton.textContent =
    "🏠 首頁";

  fragment.append(
    homeButton
  );

  MODULES.forEach(
    (module) => {
      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.className =
        "nav-button";

      button.dataset.module =
        module.id;

      button.textContent =
        `${module.icon} ${module.label}`;

      fragment.append(
        button
      );
    }
  );

  dom.topNavigation
    .replaceChildren(
      fragment
    );
}

function updateNavigation() {
  document
    .querySelectorAll(
      "[data-module]"
    )
    .forEach(
      (button) => {
        button.classList.toggle(
          "is-active",

          state.openModules.has(
            button.dataset.module
          )
        );
      }
    );

  document
    .querySelector(
      "[data-home]"
    )
    ?.classList.toggle(
      "is-active",

      state.openModules
        .size === 0
    );
}

/* ============================================
   Taxonomy Sidebar
============================================ */

function renderCategoryLoading() {
  dom.categoryTree.innerHTML = `
    <div class="module-placeholder">
      分類資料載入中…
    </div>
  `;
}

function renderCategoryTree() {
  const taxonomy =
    registry.taxonomy;

  const categories =
    new Map(
      (
        taxonomy?.categories ||
        []
      ).map(
        (category) => [
          category.id,
          category
        ]
      )
    );

  const fragment =
    document.createDocumentFragment();

  (
    taxonomy?.groups ||
    []
  ).forEach(
    (
      group,
      index
    ) => {
      const details =
        document.createElement(
          "details"
        );

      details.className =
        "category-group";

      details.open =
        index < 2;

      const summary =
        document.createElement(
          "summary"
        );

      summary.innerHTML = `
        <span>
          ${escapeHtml(
            group.icon ||
            "◆"
          )}
        </span>

        <strong>
          ${escapeHtml(
            group.nameZh
          )}
        </strong>
      `;

      details.append(
        summary
      );

      const items =
        document.createElement(
          "div"
        );

      items.className =
        "category-items";

      (
        group.categories ||
        []
      ).forEach(
        (categoryId) => {
          const category =
            categories.get(
              categoryId
            );

          if (!category) {
            return;
          }

          const button =
            document.createElement(
              "button"
            );

          button.type =
            "button";

          button.className =
            "category-button";

          button.dataset.categoryId =
            category.id;

          button.innerHTML = `
            <span>
              ${escapeHtml(
                category.nameZh
              )}
            </span>

            <small
              data-category-count="${escapeHtml(
                category.id
              )}"
            >
              0
            </small>
          `;

          items.append(
            button
          );
        }
      );

      details.append(
        items
      );

      fragment.append(
        details
      );
    }
  );

  dom.categoryTree
    .replaceChildren(
      fragment
    );

  updateCategoryButtons();

  updateCategoryCounts(
    registry.getCounts()
      .categories
  );
}

function updateCategoryCounts(
  counts = {}
) {
  document
    .querySelectorAll(
      "[data-category-count]"
    )
    .forEach(
      (element) => {
        element.textContent =
          Number(
            counts[
              element.dataset
                .categoryCount
            ] ||
            0
          ).toLocaleString(
            "zh-TW"
          );
      }
    );
}

function updateCategoryButtons() {
  document
    .querySelectorAll(
      "[data-category-id]"
    )
    .forEach(
      (button) => {
        button.classList.toggle(
          "is-active",

          state.activeCategories
            .has(
              button.dataset
                .categoryId
            )
        );
      }
    );
}

/* ============================================
   Events
============================================ */

function bindEvents() {
  document.addEventListener(
    "click",
    handleDocumentClick
  );

  dom.globalSearch
    ?.addEventListener(
      "input",
      handleGlobalSearch
    );

  dom.menuButton
    ?.addEventListener(
      "click",
      () => {
        dom.topNavigation
          .classList.toggle(
            "is-open"
          );
      }
    );

  dom.sidebarButton
    ?.addEventListener(
      "click",
      () => {
        dom.sidebar
          .classList.toggle(
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

  if (
    target.closest(
      "[data-home]"
    )
  ) {
    goHome();
    return;
  }

  const moduleButton =
    target.closest(
      "[data-module]"
    );

  if (moduleButton) {
    toggleModule(
      moduleButton.dataset
        .module
    );

    return;
  }

  const categoryButton =
    target.closest(
      "[data-category-id]"
    );

  if (categoryButton) {
    toggleCategory(
      categoryButton.dataset
        .categoryId
    );

    return;
  }

  const closeButton =
    target.closest(
      "[data-close-module]"
    );

  if (closeButton) {
    closeModule(
      closeButton.dataset
        .closeModule
    );
  }
}

function handleGlobalSearch(
  event
) {
  const query =
    event.target.value;

  ensureModuleOpen(
    "encyclopedia"
  );

  getEncyclopedia()
    ?.setQuery(query);
}

/* ============================================
   Home
============================================ */

function goHome() {
  [
    ...state.openModules
  ].forEach(
    (moduleId) => {
      closeModule(
        moduleId,
        false
      );
    }
  );

  state.activeCategories
    .clear();

  if (dom.globalSearch) {
    dom.globalSearch.value =
      "";
  }

  updateCategoryButtons();
  updateNavigation();

  dom.topNavigation
    .classList.remove(
      "is-open"
    );

  dom.sidebar
    .classList.remove(
      "is-open"
    );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* ============================================
   Module Manager
============================================ */

function toggleModule(
  moduleId
) {
  if (
    state.openModules.has(
      moduleId
    )
  ) {
    closeModule(
      moduleId
    );

    return;
  }

  openModule(
    moduleId
  );
}

function ensureModuleOpen(
  moduleId
) {
  if (
    !state.openModules.has(
      moduleId
    )
  ) {
    openModule(
      moduleId,
      false
    );
  }
}

function openModule(
  moduleId,
  scroll = true
) {
  const module =
    MODULES.find(
      (item) =>
        item.id ===
        moduleId
    );

  if (
    !module ||
    state.openModules.has(
      moduleId
    )
  ) {
    return;
  }

  state.openModules.add(
    moduleId
  );

  const node =
    createModuleNode(
      module
    );

  moduleNodes.set(
    moduleId,
    node
  );

  insertModuleNode(
    module,
    node
  );

  mountModuleContent(
    module,
    node
  );

  updateNavigation();

  dom.topNavigation
    .classList.remove(
      "is-open"
    );

  if (scroll) {
    window.requestAnimationFrame(
      () => {
        node.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }
    );
  }
}

function closeModule(
  moduleId,
  update = true
) {
  if (
    !state.openModules.has(
      moduleId
    )
  ) {
    return;
  }

  moduleControllers
    .get(moduleId)
    ?.destroy?.();

  moduleControllers.delete(
    moduleId
  );

  moduleNodes
    .get(moduleId)
    ?.remove();

  moduleNodes.delete(
    moduleId
  );

  state.openModules.delete(
    moduleId
  );

  if (update) {
    updateNavigation();
  }
}

function createModuleNode(
  module
) {
  const section =
    document.createElement(
      "section"
    );

  section.className =
    "panel module-panel";

  section.dataset.modulePanel =
    module.id;

  section.innerHTML = `
    <div class="panel-inner">

      <div class="module-panel-header">

        <div>
          <div class="panel-kicker">
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
        data-module-mount="${escapeHtml(
          module.id
        )}"
      ></div>

    </div>
  `;

  return section;
}

function insertModuleNode(
  module,
  node
) {
  const zone =
    getZone(
      module.area
    );

  const currentIndex =
    MODULES.findIndex(
      (item) =>
        item.id ===
        module.id
    );

  const nextNode =
    [...zone.children]
      .find(
        (child) => {
          const nextIndex =
            MODULES.findIndex(
              (item) =>
                item.id ===
                child.dataset
                  .modulePanel
            );

          return (
            nextIndex >
            currentIndex
          );
        }
      );

  zone.insertBefore(
    node,
    nextNode ||
    null
  );
}

function getZone(
  area
) {
  if (
    area === "builder"
  ) {
    return dom
      .promptBuilderZone;
  }

  if (
    area === "after"
  ) {
    return dom
      .afterBuilderZone;
  }

  return dom
    .beforeBuilderZone;
}

function mountModuleContent(
  module,
  node
) {
  const mount =
    node.querySelector(
      "[data-module-mount]"
    );

  if (
    module.id ===
    "encyclopedia"
  ) {
    const controller =
      createEncyclopediaController({
        registry,

        onCategoriesChange:
          (categories) => {
            state.activeCategories =
              new Set(
                categories
              );

            updateCategoryButtons();
          },

        onQueryChange:
          (query) => {
            if (
              dom.globalSearch &&
              dom.globalSearch.value !==
                query
            ) {
              dom.globalSearch.value =
                query;
            }
          }
      });

    controller.mount(
      mount
    );

    controller.setCategories(
      [
        ...state
          .activeCategories
      ]
    );

    moduleControllers.set(
      module.id,
      controller
    );

    return;
  }

  mount.innerHTML = `
    <div class="module-placeholder">

      <span class="module-status">
        v1.0.0
      </span>

      <p>
        ${escapeHtml(
          MODULE_PLACEHOLDERS[
            module.id
          ] ||
          "模組入口已建立。"
        )}
      </p>

    </div>
  `;
}

function getEncyclopedia() {
  return moduleControllers
    .get(
      "encyclopedia"
    );
}

/* ============================================
   Categories
============================================ */

function toggleCategory(
  categoryId
) {
  const resolved =
    registry.resolveCategory(
      categoryId
    );

  if (!resolved) {
    return;
  }

  if (
    state.activeCategories.has(
      resolved
    )
  ) {
    state.activeCategories.delete(
      resolved
    );
  } else {
    state.activeCategories.add(
      resolved
    );
  }

  ensureModuleOpen(
    "encyclopedia"
  );

  getEncyclopedia()
    ?.setCategories(
      [
        ...state
          .activeCategories
      ]
    );

  updateCategoryButtons();

  dom.sidebar
    .classList.remove(
      "is-open"
    );
}

/* ============================================
   Statistics
============================================ */

function updateStatistics(
  snapshot =
    registry.ready
      ? registry.snapshot()
      : null
) {
  const counts =
    snapshot?.counts ||
    {
      official: 0,
      custom: 0,
      external: 0,
      target:
        APP.presetTarget
    };

  setText(
    "#statOfficial",

    `${counts.official
      .toLocaleString(
        "zh-TW"
      )} / ${counts.target
      .toLocaleString(
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
        snapshot.counts
          .official
      );

  document.documentElement
    .dataset.customCards =
      String(
        snapshot.counts
          .custom
      );

  document.documentElement
    .dataset.externalCards =
      String(
        snapshot.counts
          .external
      );
}

/* ============================================
   Error
============================================ */

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
    <div class="panel-inner">

      <div class="panel-kicker">
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

    </div>
  `;

  home.append(
    panel
  );
}

/* ============================================
   Helpers
============================================ */

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