"use strict";

import {
  APP,
  MODULES,
  CATEGORY_GROUPS,
  MODULE_PLACEHOLDERS
} from "./core/config.js";

const state = {
  openModules: new Set(),
  activeCategories: new Set()
};

const dom = {};

boot();

function boot() {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );

    return;
  }

  initialize();
}

function initialize() {
  cacheDom();
  applyAppMetadata();
  renderNavigation();
  renderCategoryTree();
  bindEvents();
  updateStatistics();

  console.info(
    `🍮 ${APP.nameEn} v${APP.version} — Step 01 ready`
  );
}

function cacheDom() {
  dom.topNavigation =
    document.querySelector("#topNavigation");

  dom.categoryTree =
    document.querySelector("#categoryTree");

  dom.beforeBuilderZone =
    document.querySelector("#beforeBuilderZone");

  dom.afterBuilderZone =
    document.querySelector("#afterBuilderZone");

  dom.promptBuilderZone =
    document.querySelector("#promptBuilderZone");

  dom.sidebar =
    document.querySelector("#sidebar");

  dom.globalSearch =
    document.querySelector("#globalSearch");

  dom.menuButton =
    document.querySelector("#menuButton");

  dom.sidebarButton =
    document.querySelector("#sidebarButton");

  dom.promptDockButton =
    document.querySelector("#promptDockButton");

  dom.promptDockCount =
    document.querySelector("#promptDockCount");
}

function applyAppMetadata() {
  document.title =
    `${APP.nameZh}｜${APP.nameEn}`;

  document
    .querySelectorAll("[data-app-version]")
    .forEach((element) => {
      element.textContent = `v${APP.version}`;
    });

  document
    .querySelectorAll("[data-app-name-zh]")
    .forEach((element) => {
      element.textContent = APP.nameZh;
    });

  document
    .querySelectorAll("[data-preset-target]")
    .forEach((element) => {
      element.textContent =
        APP.presetTarget.toLocaleString("zh-TW");
    });

  document.documentElement.dataset.appVersion =
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
          data-module="${escapeHtml(module.id)}"
        >
          ${module.icon}
          ${escapeHtml(module.label)}
        </button>
      `
    ).join("")}
  `;
}

function renderCategoryTree() {
  dom.categoryTree.innerHTML =
    CATEGORY_GROUPS.map(
      (group, index) => `
        <details
          class="category-group"
          ${index < 2 ? "open" : ""}
        >
          <summary>
            <span>${group.icon}</span>
            <strong>${escapeHtml(group.label)}</strong>
          </summary>

          <div class="category-items">
            ${group.categories.map(
              (category) => `
                <button
                  class="category-button"
                  type="button"
                  data-category="${escapeHtml(category)}"
                >
                  ${escapeHtml(category)}
                </button>
              `
            ).join("")}
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

  dom.globalSearch?.addEventListener(
    "input",
    handleSearchInput
  );

  dom.menuButton?.addEventListener(
    "click",
    () => {
      dom.topNavigation.classList.toggle(
        "is-open"
      );
    }
  );

  dom.sidebarButton?.addEventListener(
    "click",
    () => {
      dom.sidebar.classList.toggle(
        "is-open"
      );
    }
  );

  dom.promptDockButton?.addEventListener(
    "click",
    () => {
      toggleModule("prompt-builder");
    }
  );
}

function handleDocumentClick(event) {
  const target =
    event.target instanceof Element
      ? event.target
      : null;

  if (!target) {
    return;
  }

  const homeButton =
    target.closest("[data-home]");

  if (homeButton) {
    goHome();
    return;
  }

  const moduleButton =
    target.closest("[data-module]");

  if (moduleButton) {
    toggleModule(
      moduleButton.dataset.module
    );

    return;
  }

  const categoryButton =
    target.closest("[data-category]");

  if (categoryButton) {
    toggleCategory(
      categoryButton.dataset.category
    );

    return;
  }

  const closeButton =
    target.closest("[data-close-module]");

  if (closeButton) {
    closeModule(
      closeButton.dataset.closeModule
    );
  }
}

function goHome() {
  state.openModules.clear();
  state.activeCategories.clear();

  renderOpenModules();
  updateNavigation();
  updateCategoryButtons();

  dom.topNavigation.classList.remove(
    "is-open"
  );

  dom.sidebar.classList.remove(
    "is-open"
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function toggleModule(moduleId) {
  const module =
    MODULES.find(
      (item) => item.id === moduleId
    );

  if (!module) {
    return;
  }

  if (state.openModules.has(moduleId)) {
    state.openModules.delete(moduleId);
  } else {
    state.openModules.add(moduleId);
  }

  renderOpenModules();
  updateNavigation();

  dom.topNavigation.classList.remove(
    "is-open"
  );

  window.requestAnimationFrame(() => {
    document
      .querySelector(
        `[data-module-panel="${cssEscape(moduleId)}"]`
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
  });
}

function closeModule(moduleId) {
  state.openModules.delete(moduleId);

  renderOpenModules();
  updateNavigation();
}

function toggleCategory(category) {
  if (state.activeCategories.has(category)) {
    state.activeCategories.delete(category);
  } else {
    state.activeCategories.add(category);
  }

  state.openModules.add(
    "encyclopedia"
  );

  renderOpenModules();
  updateNavigation();
  updateCategoryButtons();

  dom.sidebar.classList.remove(
    "is-open"
  );

  const placeholder =
    document.querySelector(
      '[data-module-panel="encyclopedia"] .module-placeholder'
    );

  if (placeholder) {
    const selected = [
      ...state.activeCategories
    ];

    placeholder.innerHTML = `
      <span class="module-status">
        STEP 01
      </span>

      <h3>
        已選擇百科分類
      </h3>

      <p>
        ${
          selected.length
            ? selected
                .map(
                  (item) =>
                    `「${escapeHtml(item)}」`
                )
                .join("＋")
            : "尚未選擇分類"
        }
      </p>

      <p>
        目前只確認分類互動正常。
        真正的篩選器、資料載入與卡片會在 Step 03 接上。
      </p>
    `;
  }
}

function handleSearchInput(event) {
  const query =
    event.target.value.trim();

  if (!query) {
    return;
  }

  state.openModules.add(
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
      <span class="module-status">
        SEARCH PLACEHOLDER
      </span>

      <h3>
        搜尋：${escapeHtml(query)}
      </h3>

      <p>
        Step 01 只確認搜尋入口與百科連動正常。
        真正的全文搜尋引擎會在 Step 05 製作。
      </p>
    `;
  }
}

function renderOpenModules() {
  const beforeModules =
    MODULES.filter(
      (module) =>
        module.area === "before" &&
        state.openModules.has(module.id)
    );

  const builderModules =
    MODULES.filter(
      (module) =>
        module.area === "builder" &&
        state.openModules.has(module.id)
    );

  const afterModules =
    MODULES.filter(
      (module) =>
        module.area === "after" &&
        state.openModules.has(module.id)
    );

  dom.beforeBuilderZone.innerHTML =
    beforeModules
      .map(createModulePanel)
      .join("");

  dom.promptBuilderZone.innerHTML =
    builderModules
      .map(createModulePanel)
      .join("");

  dom.afterBuilderZone.innerHTML =
    afterModules
      .map(createModulePanel)
      .join("");
}

function createModulePanel(module) {
  return `
    <section
      class="panel module-panel"
      data-module-panel="${escapeHtml(module.id)}"
    >
      <div class="panel-inner">
        <div class="module-panel-header">
          <div>
            <div class="panel-kicker">
              ${escapeHtml(module.id)}
            </div>

            <h2>
              ${module.icon}
              ${escapeHtml(module.label)}
            </h2>
          </div>

          <button
            class="module-close"
            type="button"
            data-close-module="${escapeHtml(module.id)}"
            aria-label="關閉 ${escapeHtml(module.label)}"
          >
            ×
          </button>
        </div>

        <div class="module-placeholder">
          <span class="module-status">
            STEP 01
          </span>

          <p>
            ${escapeHtml(
              MODULE_PLACEHOLDERS[module.id] ??
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
    .querySelectorAll("[data-module]")
    .forEach((button) => {
      button.classList.toggle(
        "is-active",
        state.openModules.has(
          button.dataset.module
        )
      );
    });

  const homeButton =
    document.querySelector("[data-home]");

  homeButton?.classList.toggle(
    "is-active",
    state.openModules.size === 0
  );
}

function updateCategoryButtons() {
  document
    .querySelectorAll("[data-category]")
    .forEach((button) => {
      button.classList.toggle(
        "is-active",
        state.activeCategories.has(
          button.dataset.category
        )
      );
    });
}

function updateStatistics() {
  setText(
    "#statOfficial",
    `0 / ${APP.presetTarget.toLocaleString("zh-TW")}`
  );

  setText("#statCustom", "0");
  setText("#statExternal", "0");
  setText("#statFavorites", "0");
  setText(
    "#statVersion",
    `v${APP.version}`
  );

  if (dom.promptDockCount) {
    dom.promptDockCount.textContent =
      "已加入 0 項";
  }
}

function setText(selector, value) {
  const element =
    document.querySelector(selector);

  if (element) {
    element.textContent = value;
  }
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return CSS.escape(value);
  }

  return String(value)
    .replaceAll('"', '\\"');
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}