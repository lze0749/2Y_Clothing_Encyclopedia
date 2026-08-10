"use strict";

/*
 * 2Y AI Prompt Encyclopedia
 * Card Selection Core
 * Step 04
 * Version: 1.0.0
 *
 * 責任：
 * - 管理資料卡目前選中的命名配色
 * - 管理六大可調屬性
 * - 產生目前選擇狀態的 Prompt fragments
 * - 完全不管理 DOM
 */

export const ATTRIBUTE_DEFINITIONS = Object.freeze([
  {
    id: "material",
    nameZh: "材質",
    nameEn: "Material"
  },
  {
    id: "fit",
    nameZh: "版型",
    nameEn: "Fit"
  },
  {
    id: "length",
    nameZh: "長度",
    nameEn: "Length"
  },
  {
    id: "sleeve",
    nameZh: "袖型",
    nameEn: "Sleeve"
  },
  {
    id: "neckline",
    nameZh: "領口",
    nameEn: "Neckline"
  },
  {
    id: "gender",
    nameZh: "性別",
    nameEn: "Gender Presentation"
  }
]);

const GARMENT_CATEGORIES = new Set([
  "tops-innerwear",
  "trousers",
  "skirts",
  "dresses",
  "outerwear-capes-shawls"
]);

const WEARABLE_CATEGORIES = new Set([
  "accessories",
  "hair-accessories",
  "shoes",
  "leg-accessories",
  "socks",
  "hand-accessories",
  "nail-art",
  "bags",
  "waist-accessories"
]);

const APPEARANCE_CATEGORIES = new Set([
  "hairstyles",
  "eyes",
  "makeup",
  "special-styling"
]);

const POSE_CATEGORIES = new Set([
  "single-poses",
  "duo-poses"
]);

const CAMERA_CATEGORIES = new Set([
  "camera",
  "composition",
  "lighting",
  "filters",
  "atmosphere",
  "purpose"
]);

const SCENE_CATEGORIES = new Set([
  "ground-items",
  "sky-items",
  "animals",
  "plants",
  "food",
  "foreground-items",
  "background-scenes",
  "handheld-props"
]);

export function getCardKind(category) {
  if (GARMENT_CATEGORIES.has(category)) {
    return "garment";
  }

  if (WEARABLE_CATEGORIES.has(category)) {
    return "wearable";
  }

  if (APPEARANCE_CATEGORIES.has(category)) {
    return "appearance";
  }

  if (POSE_CATEGORIES.has(category)) {
    return "pose";
  }

  if (CAMERA_CATEGORIES.has(category)) {
    return "camera";
  }

  if (SCENE_CATEGORIES.has(category)) {
    return "scene";
  }

  return "generic";
}

export function getVisibleAttributes(card) {
  const kind = getCardKind(card?.category);

  /*
   * 姿勢、攝影、場景類不顯示服裝六大屬性。
   * 就算資料包亂塞，也不讓 UI 跟著發瘋。
   */
  if (
    kind === "pose" ||
    kind === "camera" ||
    kind === "scene"
  ) {
    return [];
  }

  const allowed =
    kind === "appearance"
      ? new Set([
          "material",
          "fit",
          "length",
          "gender"
        ])
      : new Set(
          ATTRIBUTE_DEFINITIONS.map(
            (item) => item.id
          )
        );

  return ATTRIBUTE_DEFINITIONS.filter(
    (definition) => {
      return (
        allowed.has(definition.id) &&
        Array.isArray(
          card?.attributes?.[
            definition.id
          ]
        ) &&
        card.attributes[
          definition.id
        ].length > 0
      );
    }
  );
}

class CardSelectionStore {
  #states = new Map();

  #listeners = new Set();

  ensure(card) {
    if (!card?.id) {
      throw new Error(
        "Card Selection：資料卡缺少 id。"
      );
    }

    let state =
      this.#states.get(card.id);

    if (!state) {
      state = {
        cardId: card.id,

        colorwayId:
          card.colorways?.[0]?.id ||
          "",

        attributes: {}
      };

      getVisibleAttributes(card)
        .forEach((definition) => {
          state.attributes[
            definition.id
          ] =
            card.attributes[
              definition.id
            ]?.[0]?.id ||
            "";
        });

      this.#states.set(
        card.id,
        state
      );
    }

    this.#repair(card, state);

    return clone(state);
  }

  get(card) {
    return this.ensure(card);
  }

  setColorway(
    card,
    colorwayId
  ) {
    const state =
      this.ensure(card);

    const exists =
      card.colorways?.some(
        (colorway) =>
          colorway.id ===
          colorwayId
      );

    if (!exists) {
      return this.getSnapshot(card);
    }

    const stored =
      this.#states.get(card.id);

    stored.colorwayId =
      colorwayId;

    this.#notify(
      card,
      "colorway"
    );

    return this.getSnapshot(card);
  }

  setAttribute(
    card,
    attributeId,
    optionId
  ) {
    const definition =
      getVisibleAttributes(card)
        .find(
          (item) =>
            item.id ===
            attributeId
        );

    if (!definition) {
      return this.getSnapshot(card);
    }

    const exists =
      card.attributes[
        attributeId
      ]?.some(
        (option) =>
          option.id ===
          optionId
      );

    if (!exists) {
      return this.getSnapshot(card);
    }

    const stored =
      this.#states.get(card.id);

    stored.attributes[
      attributeId
    ] =
      optionId;

    this.#notify(
      card,
      `attribute:${attributeId}`
    );

    return this.getSnapshot(card);
  }

  reset(card) {
    this.#states.delete(
      card.id
    );

    const state =
      this.ensure(card);

    this.#notify(
      card,
      "reset"
    );

    return state;
  }

  resetAll() {
    this.#states.clear();

    for (
      const callback
      of this.#listeners
    ) {
      callback({
        type: "reset-all"
      });
    }
  }

  getSelectedColorway(card) {
    const state =
      this.ensure(card);

    return (
      card.colorways?.find(
        (colorway) =>
          colorway.id ===
          state.colorwayId
      ) ||
      card.colorways?.[0] ||
      null
    );
  }

  getSelectedAttribute(
    card,
    attributeId
  ) {
    const state =
      this.ensure(card);

    const optionId =
      state.attributes[
        attributeId
      ];

    return (
      card.attributes?.[
        attributeId
      ]?.find(
        (option) =>
          option.id ===
          optionId
      ) ||
      null
    );
  }

  getPositiveFragments(card) {
    const fragments = [
      ...(
        card.prompt?.positive ||
        []
      )
    ];

    const colorway =
      this.getSelectedColorway(
        card
      );

    /*
     * 顏色 Prompt 只使用文字名稱。
     * palette.hex 永遠不進 Prompt。
     */
    fragments.push(
      ...(
        colorway?.prompt ||
        []
      )
    );

    getVisibleAttributes(card)
      .forEach((definition) => {
        const option =
          this.getSelectedAttribute(
            card,
            definition.id
          );

        if (option?.prompt) {
          fragments.push(
            option.prompt
          );
        }
      });

    return uniqueFragments(
      fragments
    );
  }

  getNegativeFragments(card) {
    return uniqueFragments(
      card.prompt?.negative ||
      []
    );
  }

  getSnapshot(card) {
    const state =
      this.ensure(card);

    const colorway =
      this.getSelectedColorway(
        card
      );

    const attributes = {};

    getVisibleAttributes(card)
      .forEach((definition) => {
        const option =
          this.getSelectedAttribute(
            card,
            definition.id
          );

        attributes[
          definition.id
        ] =
          option
            ? clone(option)
            : null;
      });

    const positiveFragments =
      this.getPositiveFragments(
        card
      );

    const negativeFragments =
      this.getNegativeFragments(
        card
      );

    return {
      cardId: card.id,

      kind:
        getCardKind(
          card.category
        ),

      category:
        card.category,

      colorway:
        colorway
          ? clone(colorway)
          : null,

      attributes,

      positiveFragments,

      negativeFragments,

      positivePrompt:
        positiveFragments.join(
          ", "
        ),

      negativePrompt:
        negativeFragments.join(
          ", "
        )
    };
  }

  subscribe(callback) {
    if (
      typeof callback !==
      "function"
    ) {
      throw new TypeError(
        "Card Selection subscribe() 需要函式。"
      );
    }

    this.#listeners.add(
      callback
    );

    return () => {
      this.#listeners.delete(
        callback
      );
    };
  }

  #repair(
    card,
    state
  ) {
    if (
      state.colorwayId &&
      !card.colorways?.some(
        (item) =>
          item.id ===
          state.colorwayId
      )
    ) {
      state.colorwayId =
        card.colorways?.[0]?.id ||
        "";
    }

    getVisibleAttributes(card)
      .forEach((definition) => {
        const options =
          card.attributes[
            definition.id
          ] ||
          [];

        const current =
          state.attributes[
            definition.id
          ];

        if (
          !options.some(
            (option) =>
              option.id ===
              current
          )
        ) {
          state.attributes[
            definition.id
          ] =
            options[0]?.id ||
            "";
        }
      });
  }

  #notify(
    card,
    reason
  ) {
    const message = {
      type: "card-selection-changed",
      cardId: card.id,
      reason,
      snapshot:
        this.getSnapshot(
          card
        )
    };

    for (
      const callback
      of this.#listeners
    ) {
      try {
        callback(message);
      } catch (error) {
        console.error(
          "Card Selection subscriber error:",
          error
        );
      }
    }
  }
}

function uniqueFragments(
  values
) {
  const output = [];
  const seen = new Set();

  (
    Array.isArray(values)
      ? values
      : []
  ).forEach((value) => {
    const text =
      String(value || "")
        .trim();

    if (!text) {
      return;
    }

    const key =
      text.toLowerCase();

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    output.push(text);
  });

  return output;
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

export const cardSelection =
  new CardSelectionStore();