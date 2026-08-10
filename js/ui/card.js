"use strict";

/*
 * 2Y AI Prompt Encyclopedia
 * Card UI System
 * Step 04
 * Version: 1.0.0
 */

import {
  cardSelection,
  getCardKind,
  getVisibleAttributes,
  ATTRIBUTE_DEFINITIONS
} from "../core/card-selection.js";

const PLATFORM_LABELS =
  Object.freeze({
    pixai: "PixAI",
    niji: "Niji",
    tensorart: "TensorArt",
    "gpt-image": "GPT Image"
  });

const SOURCE_LABELS =
  Object.freeze({
    official: "官方預設",
    custom: "自訂資料",
    external: "外掛資料"
  });

const KIND_META =
  Object.freeze({
    garment: {
      icon: "👗",
      label: "服裝"
    },

    wearable: {
      icon: "💎",
      label: "穿戴配件"
    },

    appearance: {
      icon: "💇",
      label: "角色外觀"
    },

    pose: {
      icon: "🕺",
      label: "姿勢"
    },

    scene: {
      icon: "🌍",
      label: "場景元素"
    },

    camera: {
      icon: "🎥",
      label: "攝影元素"
    },

    generic: {
      icon: "◆",
      label: "百科項目"
    }
  });

export function createCardSystem({
  registry,
  root
}) {
  let detailDialog = null;
  let activeDetailCardId = "";

  const unsubscribe =
    cardSelection.subscribe(
      (message) => {
        if (
          message.type !==
          "card-selection-changed"
        ) {
          return;
        }

        refreshVisibleCard(
          message.cardId
        );

        if (
          activeDetailCardId ===
          message.cardId
        ) {
          renderDetail(
            message.cardId
          );
        }
      }
    );

  createDetailDialog();

  function createCardElement(card) {
    const article =
      document.createElement(
        "article"
      );

    const kind =
      getCardKind(
        card.category
      );

    article.className =
      `card-v1 card-v1--${kind}`;

    article.dataset.cardId =
      card.id;

    article.dataset.cardKind =
      kind;

    fillCard(
      article,
      card
    );

    article.addEventListener(
      "change",
      handleCardChange
    );

    article.addEventListener(
      "click",
      handleCardClick
    );

    return article;
  }

  function fillCard(
    article,
    card
  ) {
    const kind =
      getCardKind(
        card.category
      );

    const kindMeta =
      KIND_META[kind];

    const snapshot =
      cardSelection
        .getSnapshot(card);

    const category =
      registry.getCategory(
        card.category
      );

    const colorway =
      snapshot.colorway;

    article.style.setProperty(
      "--card-v1-accent",
      safeHex(
        colorway?.palette?.[0]
          ?.hex
      )
    );

    article.innerHTML = `
      <div class="card-v1-accent"></div>

      <div class="card-v1-body">

        <header class="card-v1-header">

          <div class="card-v1-heading">

            <div class="card-v1-overline">
              <span>
                ${kindMeta.icon}
                ${escapeHtml(
                  kindMeta.label
                )}
              </span>

              <span>
                ${escapeHtml(
                  category?.nameZh ||
                  card.category
                )}
              </span>
            </div>

            <h3>
              ${escapeHtml(
                card.nameZh
              )}
            </h3>

            <p class="card-v1-name-en">
              ${escapeHtml(
                card.nameEn
              )}
            </p>

          </div>

          <div class="card-v1-head-actions">

            <span class="card-v1-source">
              ${escapeHtml(
                SOURCE_LABELS[
                  card.source?.type
                ] ||
                "未知來源"
              )}
            </span>

            <button
              class="card-v1-pudding"
              type="button"
              data-card-v1-action="favorite"
              aria-label="收藏"
              aria-pressed="false"
              title="收藏系統將於 Step 06 啟用"
            >
              🍮
            </button>

          </div>

        </header>

        ${
          card.descriptionZh
            ? `
              <p class="card-v1-description">
                ${escapeHtml(
                  card.descriptionZh
                )}
              </p>
            `
            : ""
        }

        ${createPlatformHtml(
          card
        )}

        ${createColorwayHtml(
          card,
          snapshot
        )}

        ${createAttributeHtml(
          card,
          snapshot
        )}

        ${createTagHtml(
          card
        )}

        ${createRelationPreview(
          card
        )}

        <section class="card-v1-prompt">

          <div class="card-v1-section-head">
            <strong>
              Prompt
            </strong>

            <button
              type="button"
              data-card-v1-action="copy-positive"
            >
              複製
            </button>
          </div>

          <p data-card-v1-positive>
            ${escapeHtml(
              snapshot
                .positivePrompt
            )}
          </p>

        </section>

        <section
          class="
            card-v1-prompt
            card-v1-prompt--negative
          "
        >

          <div class="card-v1-section-head">
            <strong>
              Negative Prompt
            </strong>

            <button
              type="button"
              data-card-v1-action="copy-negative"
            >
              複製
            </button>
          </div>

          <p data-card-v1-negative>
            ${escapeHtml(
              snapshot
                .negativePrompt
            )}
          </p>

        </section>

        <footer class="card-v1-footer">

          <button
            type="button"
            data-card-v1-action="detail"
          >
            🔍 詳細資料
          </button>

          <button
            type="button"
            data-card-v1-action="builder"
          >
            ＋ 加入提示詞組合器
          </button>

        </footer>

      </div>
    `;
  }

  function handleCardChange(
    event
  ) {
    const target =
      event.target;

    const article =
      target.closest(
        ".card-v1"
      );

    if (!article) {
      return;
    }

    const card =
      registry.getCard(
        article.dataset.cardId
      );

    if (!card) {
      return;
    }

    if (
      target.matches(
        "[data-card-v1-colorway]"
      )
    ) {
      cardSelection
        .setColorway(
          card,
          target.value
        );

      return;
    }

    if (
      target.matches(
        "[data-card-v1-attribute]"
      )
    ) {
      cardSelection
        .setAttribute(
          card,
          target.dataset
            .attributeId,

          target.value
        );
    }
  }

  function handleCardClick(
    event
  ) {
    const button =
      event.target.closest(
        "[data-card-v1-action]"
      );

    if (!button) {
      return;
    }

    const article =
      button.closest(
        ".card-v1"
      );

    const cardId =
      article?.dataset.cardId;

    const card =
      registry.getCard(
        cardId
      );

    if (!card) {
      return;
    }

    const action =
      button.dataset
        .cardV1Action;

    if (
      action ===
      "copy-positive"
    ) {
      copyText(
        cardSelection
          .getSnapshot(card)
          .positivePrompt,

        button
      );

      return;
    }

    if (
      action ===
      "copy-negative"
    ) {
      copyText(
        cardSelection
          .getSnapshot(card)
          .negativePrompt,

        button
      );

      return;
    }

    if (
      action ===
      "detail"
    ) {
      openDetail(
        card.id
      );

      return;
    }

    if (
      action ===
      "favorite"
    ) {
      showNotice(
        "🍮 收藏資料結構已預留，正式收藏會在 Step 06 接上。"
      );

      return;
    }

    if (
      action ===
      "builder"
    ) {
      const snapshot =
        cardSelection
          .getSnapshot(card);

      console.info(
        "[Card → Prompt Builder]",
        snapshot
      );

      showNotice(
        "🧩 Card Selection API 已準備好，Step 07 會正式接入 Prompt Builder。"
      );
    }
  }

  function refreshVisibleCard(
    cardId
  ) {
    const card =
      registry.getCard(
        cardId
      );

    if (!card) {
      return;
    }

    const selector =
      `[data-card-id="${cssEscape(
        cardId
      )}"]`;

    const article =
      root.querySelector(
        selector
      );

    if (!article) {
      return;
    }

    /*
     * 只重畫這一張 Card。
     * 不碰 Encyclopedia filter、
     * pagination、其他 Card。
     */
    fillCard(
      article,
      card
    );

    article.classList.add(
      "is-updated"
    );

    window.setTimeout(
      () => {
        article.classList
          .remove(
            "is-updated"
          );
      },
      320
    );
  }

  function openDetail(
    cardId
  ) {
    activeDetailCardId =
      cardId;

    renderDetail(
      cardId
    );

    if (
      typeof detailDialog
        .showModal ===
      "function"
    ) {
      if (!detailDialog.open) {
        detailDialog
          .showModal();
      }
    } else {
      detailDialog
        .setAttribute(
          "open",
          ""
        );
    }
  }

  function createDetailDialog() {
    detailDialog =
      document.createElement(
        "dialog"
      );

    detailDialog.className =
      "card-detail-dialog";

    detailDialog.addEventListener(
      "click",
      handleDetailClick
    );

    detailDialog.addEventListener(
      "change",
      handleDetailChange
    );

    detailDialog.addEventListener(
      "close",
      () => {
        activeDetailCardId =
          "";
      }
    );

    document.body.append(
      detailDialog
    );
  }

  function renderDetail(
    cardId
  ) {
    const card =
      registry.getCard(
        cardId
      );

    if (!card) {
      detailDialog.innerHTML = `
        <div class="card-detail-shell">
          <p>
            找不到資料卡。
          </p>
        </div>
      `;

      return;
    }

    const snapshot =
      cardSelection
        .getSnapshot(card);

    const category =
      registry.getCategory(
        card.category
      );

    const kind =
      getCardKind(
        card.category
      );

    const meta =
      KIND_META[kind];

    detailDialog.innerHTML = `
      <article class="card-detail-shell">

        <header class="card-detail-header">

          <div>
            <div class="card-v1-overline">
              ${meta.icon}
              ${escapeHtml(
                meta.label
              )}

              ·

              ${escapeHtml(
                category?.nameZh ||
                card.category
              )}
            </div>

            <h2>
              ${escapeHtml(
                card.nameZh
              )}
            </h2>

            <p>
              ${escapeHtml(
                card.nameEn
              )}
            </p>
          </div>

          <button
            class="card-detail-close"
            type="button"
            data-card-detail-action="close"
            aria-label="關閉"
          >
            ×
          </button>

        </header>

        ${
          card.descriptionZh
            ? `
              <p class="card-detail-description">
                ${escapeHtml(
                  card.descriptionZh
                )}
              </p>
            `
            : ""
        }

        <div class="card-detail-grid">

          <section>
            <h3>
              命名配色
            </h3>

            ${createDetailColorways(
              card,
              snapshot
            )}
          </section>

          <section>
            <h3>
              可調屬性
            </h3>

            ${createDetailAttributes(
              card,
              snapshot
            )}
          </section>

          <section class="card-detail-wide">
            <h3>
              Prompt
            </h3>

            <div class="card-detail-prompt">
              ${escapeHtml(
                snapshot
                  .positivePrompt
              )}
            </div>
          </section>

          <section class="card-detail-wide">
            <h3>
              Negative Prompt
            </h3>

            <div
              class="
                card-detail-prompt
                is-negative
              "
            >
              ${escapeHtml(
                snapshot
                  .negativePrompt
              )}
            </div>
          </section>

          <section>
            <h3>
              標籤
            </h3>

            ${createTagHtml(
              card
            )}
          </section>

          <section>
            <h3>
              平台
            </h3>

            ${createPlatformHtml(
              card
            )}
          </section>

          <section class="card-detail-wide">
            <h3>
              相似項目
            </h3>

            ${createRelationDetail(
              card.relations
                ?.similarItems
            )}
          </section>

          <section class="card-detail-wide">
            <h3>
              可搭配項目
            </h3>

            ${createRelationDetail(
              card.relations
                ?.matchingItems
            )}
          </section>

          ${createAnatomyPreview(
            card
          )}

        </div>

        <footer class="card-detail-footer">

          <span>
            ID：
            ${escapeHtml(
              card.id
            )}
          </span>

          <span>
            ${
              escapeHtml(
                SOURCE_LABELS[
                  card.source?.type
                ] ||
                card.source?.type ||
                ""
              )
            }
            ·
            ${escapeHtml(
              card.source?.packId ||
              ""
            )}
          </span>

          <button
            type="button"
            data-card-detail-action="copy"
          >
            複製目前 Prompt
          </button>

        </footer>

      </article>
    `;
  }

  function handleDetailClick(
    event
  ) {
    const button =
      event.target.closest(
        "[data-card-detail-action]"
      );

    if (!button) {
      return;
    }

    const action =
      button.dataset
        .cardDetailAction;

    if (
      action ===
      "close"
    ) {
      detailDialog.close?.();

      if (
        detailDialog.open
      ) {
        detailDialog
          .removeAttribute(
            "open"
          );
      }

      return;
    }

    if (
      action ===
      "related"
    ) {
      const cardId =
        button.dataset.cardId;

      if (
        registry.getCard(
          cardId
        )
      ) {
        activeDetailCardId =
          cardId;

        renderDetail(
          cardId
        );
      }

      return;
    }

    if (
      action ===
      "copy"
    ) {
      const card =
        registry.getCard(
          activeDetailCardId
        );

      if (card) {
        copyText(
          cardSelection
            .getSnapshot(card)
            .positivePrompt,

          button
        );
      }
    }
  }

  function handleDetailChange(
    event
  ) {
    const card =
      registry.getCard(
        activeDetailCardId
      );

    if (!card) {
      return;
    }

    const target =
      event.target;

    if (
      target.matches(
        "[data-detail-colorway]"
      )
    ) {
      cardSelection
        .setColorway(
          card,
          target.value
        );

      return;
    }

    if (
      target.matches(
        "[data-detail-attribute]"
      )
    ) {
      cardSelection
        .setAttribute(
          card,
          target.dataset
            .attributeId,

          target.value
        );
    }
  }

  function createColorwayHtml(
    card,
    snapshot
  ) {
    if (
      !card.colorways?.length
    ) {
      return "";
    }

    return `
      <section class="card-v1-options">

        <div class="card-v1-section-head">
          <strong>
            命名配色
          </strong>
        </div>

        <select
          data-card-v1-control
          data-card-v1-colorway
          aria-label="命名配色"
        >
          ${card.colorways
            .map(
              (item) => `
                <option
                  value="${escapeHtml(
                    item.id
                  )}"
                  ${
                    snapshot.colorway
                      ?.id ===
                    item.id
                      ? "selected"
                      : ""
                  }
                >
                  ${escapeHtml(
                    item.nameZh
                  )}

                  ${
                    item.nameEn
                      ? ` · ${escapeHtml(
                          item.nameEn
                        )}`
                      : ""
                  }
                </option>
              `
            )
            .join("")}
        </select>

        <div class="card-v1-swatches">
          ${createSwatches(
            snapshot.colorway
          )}
        </div>

      </section>
    `;
  }

  function createAttributeHtml(
    card,
    snapshot
  ) {
    const attributes =
      getVisibleAttributes(
        card
      );

    if (!attributes.length) {
      return "";
    }

    return `
      <section class="card-v1-attributes">

        ${attributes
          .map(
            (definition) => {
              const options =
                card.attributes[
                  definition.id
                ];

              const selected =
                snapshot.attributes[
                  definition.id
                ]?.id;

              return `
                <label>
                  <span>
                    ${escapeHtml(
                      definition.nameZh
                    )}
                  </span>

                  <select
                    data-card-v1-control
                    data-card-v1-attribute
                    data-attribute-id="${escapeHtml(
                      definition.id
                    )}"
                  >
                    ${options
                      .map(
                        (option) => `
                          <option
                            value="${escapeHtml(
                              option.id
                            )}"
                            ${
                              selected ===
                              option.id
                                ? "selected"
                                : ""
                            }
                          >
                            ${escapeHtml(
                              option.nameZh ||
                              option.nameEn
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

  function createPlatformHtml(
    card
  ) {
    return `
      <div class="card-v1-platforms">

        ${(
          card.platforms ||
          []
        )
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
    `;
  }

  function createTagHtml(
    card
  ) {
    if (!card.tags?.length) {
      return `
        <span class="card-v1-empty">
          尚無標籤
        </span>
      `;
    }

    return `
      <div class="card-v1-tags">

        ${card.tags
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
    `;
  }

  function createRelationPreview(
    card
  ) {
    const similar =
      resolveRelations(
        card.relations
          ?.similarItems
      ).slice(0, 3);

    const matching =
      resolveRelations(
        card.relations
          ?.matchingItems
      ).slice(0, 3);

    if (
      !similar.length &&
      !matching.length
    ) {
      return "";
    }

    return `
      <section class="card-v1-relations">

        ${
          similar.length
            ? `
              <div>
                <strong>
                  相似
                </strong>

                ${similar
                  .map(
                    createRelationLabel
                  )
                  .join("")}
              </div>
            `
            : ""
        }

        ${
          matching.length
            ? `
              <div>
                <strong>
                  可搭配
                </strong>

                ${matching
                  .map(
                    createRelationLabel
                  )
                  .join("")}
              </div>
            `
            : ""
        }

      </section>
    `;
  }

  function createRelationDetail(
    ids
  ) {
    const relations =
      resolveRelations(ids);

    if (!relations.length) {
      return `
        <p class="card-v1-empty">
          尚未設定
        </p>
      `;
    }

    return `
      <div class="card-detail-relations">

        ${relations
          .map(
            (item) => `
              <button
                type="button"
                data-card-detail-action="related"
                data-card-id="${escapeHtml(
                  item.id
                )}"
                ${
                  item.exists
                    ? ""
                    : "disabled"
                }
              >
                ${escapeHtml(
                  item.name
                )}
              </button>
            `
          )
          .join("")}

      </div>
    `;
  }

  function resolveRelations(
    ids
  ) {
    return (
      Array.isArray(ids)
        ? ids
        : []
    )
      .map(
        (id) => {
          const related =
            registry.getCard(
              id
            );

          return {
            id,

            exists:
              Boolean(
                related
              ),

            name:
              related?.nameZh ||
              related?.nameEn ||
              id
          };
        }
      );
  }

  function createRelationLabel(
    item
  ) {
    return `
      <span>
        ${escapeHtml(
          item.name
        )}
      </span>
    `;
  }

  function createDetailColorways(
    card,
    snapshot
  ) {
    if (
      !card.colorways?.length
    ) {
      return `
        <p class="card-v1-empty">
          此項目沒有命名配色。
        </p>
      `;
    }

    return `
      <select
        data-card-v1-control
        data-detail-colorway
      >
        ${card.colorways
          .map(
            (item) => `
              <option
                value="${escapeHtml(
                  item.id
                )}"
                ${
                  snapshot.colorway
                    ?.id ===
                  item.id
                    ? "selected"
                    : ""
                }
              >
                ${escapeHtml(
                  item.nameZh
                )}
              </option>
            `
          )
          .join("")}
      </select>

      <div class="card-detail-palettes">

        ${card.colorways
          .map(
            (item) => `
              <div
                class="${
                  item.id ===
                  snapshot.colorway
                    ?.id
                    ? "is-selected"
                    : ""
                }"
              >
                <strong>
                  ${escapeHtml(
                    item.nameZh
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    item.nameEn
                  )}
                </small>

                <div class="card-v1-swatches">
                  ${createSwatches(
                    item
                  )}
                </div>
              </div>
            `
          )
          .join("")}

      </div>
    `;
  }

  function createDetailAttributes(
    card,
    snapshot
  ) {
    const attributes =
      getVisibleAttributes(
        card
      );

    if (!attributes.length) {
      return `
        <p class="card-v1-empty">
          此類型沒有服飾可調屬性。
        </p>
      `;
    }

    return `
      <div class="card-detail-attributes">

        ${attributes
          .map(
            (definition) => `
              <label>
                <span>
                  ${escapeHtml(
                    definition.nameZh
                  )}
                </span>

                <select
                  data-card-v1-control
                  data-detail-attribute
                  data-attribute-id="${escapeHtml(
                    definition.id
                  )}"
                >
                  ${card.attributes[
                    definition.id
                  ]
                    .map(
                      (option) => `
                        <option
                          value="${escapeHtml(
                            option.id
                          )}"
                          ${
                            snapshot
                              .attributes[
                                definition.id
                              ]?.id ===
                            option.id
                              ? "selected"
                              : ""
                          }
                        >
                          ${escapeHtml(
                            option.nameZh ||
                            option.nameEn
                          )}
                        </option>
                      `
                    )
                    .join("")}
                </select>
              </label>
            `
          )
          .join("")}

      </div>
    `;
  }

  function createAnatomyPreview(
    card
  ) {
    const anatomy =
      card.anatomy;

    if (
      !anatomy ||
      typeof anatomy !==
        "object"
    ) {
      return "";
    }

    const hasContent =
      anatomy.definition ||
      anatomy.silhouette ||
      anatomy.structure?.length ||
      anatomy.commonAiErrors?.length;

    if (!hasContent) {
      return "";
    }

    return `
      <section class="card-detail-wide">
        <h3>
          🎓 服飾結構預覽
        </h3>

        ${
          anatomy.definition
            ? `
              <p>
                ${escapeHtml(
                  anatomy.definition
                )}
              </p>
            `
            : ""
        }

        ${
          anatomy.silhouette
            ? `
              <p>
                <strong>
                  輪廓：
                </strong>

                ${escapeHtml(
                  anatomy.silhouette
                )}
              </p>
            `
            : ""
        }

        ${
          anatomy.structure?.length
            ? `
              <div class="card-v1-tags">

                ${anatomy.structure
                  .map(
                    (item) => `
                      <span>
                        ${escapeHtml(
                          item
                        )}
                      </span>
                    `
                  )
                  .join("")}

              </div>
            `
            : ""
        }

        ${
          anatomy.commonAiErrors
            ?.length
            ? `
              <p class="card-detail-warning">
                AI 常見錯誤：
                ${escapeHtml(
                  anatomy
                    .commonAiErrors
                    .join("、")
                )}
              </p>
            `
            : ""
        }

        <small>
          完整服飾知識教室會在 Step 15 啟用。
        </small>

      </section>
    `;
  }

  function createSwatches(
    colorway
  ) {
    return (
      colorway?.palette ||
      []
    )
      .map(
        (color) => `
          <span
            class="card-v1-swatch"
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

  async function copyText(
    text,
    button
  ) {
    if (!text) {
      showNotice(
        "沒有可以複製的內容。"
      );

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

  function showNotice(
    message
  ) {
    let container =
      document.querySelector(
        "#cardV1ToastContainer"
      );

    if (!container) {
      container =
        document.createElement(
          "div"
        );

      container.id =
        "cardV1ToastContainer";

      container.className =
        "card-v1-toast-container";

      document.body.append(
        container
      );
    }

    const toast =
      document.createElement(
        "div"
      );

    toast.className =
      "card-v1-toast";

    toast.textContent =
      message;

    container.append(
      toast
    );

    window.setTimeout(
      () => {
        toast.remove();
      },
      2600
    );
  }

  function destroy() {
    unsubscribe();

    detailDialog?.remove();

    detailDialog = null;
  }

  return Object.freeze({
    createCardElement,
    openDetail,
    destroy,

    getSelection(cardId) {
      const card =
        registry.getCard(
          cardId
        );

      return card
        ? cardSelection
            .getSnapshot(card)
        : null;
    }
  });
}

function safeHex(value) {
  return /^#[0-9a-f]{6}$/i
    .test(
      String(value || "")
    )
      ? value
      : "#C400FF";
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return CSS.escape(
      value
    );
  }

  return String(value)
    .replaceAll(
      "\\",
      "\\\\"
    )
    .replaceAll(
      '"',
      '\\"'
    );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}