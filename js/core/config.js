"use strict";

/*
 * 2Y AI Prompt Encyclopedia
 * Core Configuration
 * Version: 1.0.0
 */

export const APP = Object.freeze({
  nameZh: "2Y的服飾百科",
  nameEn: "2Y AI Prompt Encyclopedia",
  version: "1.0.0",
  presetTarget: 60000,
  defaultLanguage: "zh-TW"
});

export const BRAND = Object.freeze({
  primary: "#C400FF",
  accent: "#39FF14",
  background: "#08070B",
  mascot: "🍮",
  style: "Cyberpunk × Neon × Cute × Horror"
});

export const MODULES = Object.freeze([
  {
    id: "encyclopedia",
    label: "百科",
    icon: "📚",
    area: "before"
  },
  {
    id: "custom-card",
    label: "自訂服飾卡",
    icon: "🪪",
    area: "before"
  },
  {
    id: "parameter-lab",
    label: "參數實驗室",
    icon: "🧪",
    area: "before"
  },
  {
    id: "prompt-builder",
    label: "提示詞組合器",
    icon: "🧩",
    area: "builder"
  },
  {
    id: "randomizer",
    label: "隨機穿搭",
    icon: "🎲",
    area: "after"
  },
  {
    id: "multi-character",
    label: "單／多人角色穿搭設置",
    icon: "👥",
    area: "after"
  },
  {
    id: "converter",
    label: "多平台提示詞轉換器",
    icon: "🔄",
    area: "after"
  },
  {
    id: "quality-checker",
    label: "提示詞品質檢查器",
    icon: "🛡️",
    area: "after"
  },
  {
    id: "history",
    label: "提示詞歷史紀錄",
    icon: "🕘",
    area: "after"
  },
  {
    id: "garment-classroom",
    label: "服飾知識教室",
    icon: "🎓",
    area: "after"
  },
  {
    id: "project-manager",
    label: "角色造型專案管理",
    icon: "🗂️",
    area: "after"
  },
  {
    id: "batch-creator",
    label: "批次服裝資料製作器",
    icon: "📑",
    area: "after"
  },
  {
    id: "data-pack-studio",
    label: "服裝資料包工作室",
    icon: "📦",
    area: "after"
  },
  {
    id: "data-pack-manager",
    label: "服裝資料包管理器",
    icon: "🧰",
    area: "after"
  },
  {
    id: "publish-assistant",
    label: "資料包發布助手",
    icon: "🚀",
    area: "after"
  },
  {
    id: "health-dashboard",
    label: "百科健康檢查儀表板",
    icon: "🩺",
    area: "after"
  }
]);

export const CATEGORY_GROUPS = Object.freeze([
  {
    id: "garments",
    label: "服裝",
    icon: "👗",
    categories: [
      "上衣／內搭",
      "褲子",
      "裙子",
      "連身裙",
      "外套／斗篷／披肩"
    ]
  },
  {
    id: "accessories",
    label: "配件",
    icon: "💎",
    categories: [
      "飾品配件",
      "腿飾",
      "手部配件",
      "腰部配飾",
      "包袋",
      "手持配件"
    ]
  },
  {
    id: "appearance",
    label: "外觀",
    icon: "💇",
    categories: [
      "髮型",
      "髮飾",
      "眼睛",
      "妝容",
      "美甲"
    ]
  },
  {
    id: "feet",
    label: "足部",
    icon: "👢",
    categories: [
      "鞋子",
      "襪子"
    ]
  },
  {
    id: "special",
    label: "特殊造型",
    icon: "🪽",
    categories: [
      "特殊造型"
    ]
  },
  {
    id: "poses",
    label: "姿勢",
    icon: "🕺",
    categories: [
      "單人姿勢",
      "雙人姿勢"
    ]
  },
  {
    id: "scene",
    label: "場景元素",
    icon: "🌍",
    categories: [
      "地面物品",
      "天空物品",
      "動物",
      "植物",
      "食物",
      "前景物品",
      "背景場景"
    ]
  },
  {
    id: "camera",
    label: "攝影",
    icon: "🎥",
    categories: [
      "鏡頭",
      "構圖",
      "光線",
      "濾鏡",
      "氛圍",
      "用途"
    ]
  }
]);

export const MODULE_PLACEHOLDERS = Object.freeze({
  encyclopedia:
    "百科骨架已建立。Step 03 會加入真正的資料瀏覽、篩選、分頁與卡片。",

  "custom-card":
    "自訂服飾卡入口已預留。正式編輯器會在 Step 10 製作。",

  "parameter-lab":
    "參數實驗室入口已預留。正式功能會在 Step 11 製作。",

  "prompt-builder":
    "Prompt Builder 展開區已建立。正式拖曳、分段與組合邏輯會在 Step 07 製作。",

  randomizer:
    "隨機穿搭入口已預留。正式鎖定與智能隨機會在 Step 12 製作。",

  "multi-character":
    "1～4 人角色穿搭入口已預留。正式功能會在 Step 13 製作。",

  converter:
    "PixAI、Niji、TensorArt、GPT Image 四平台轉換入口已預留。",

  "quality-checker":
    "品質檢查器入口已預留。正式檢查核心會在 Step 08 製作。",

  history:
    "提示詞歷史紀錄入口已預留，未來上限 200 筆。",

  "garment-classroom":
    "服飾知識教室入口已預留。正式 Anatomy 架構會在 Step 15 製作。",

  "project-manager":
    "O.C. 角色造型專案管理入口已預留。",

  "batch-creator":
    "CSV／JSON 批次製作入口已預留。",

  "data-pack-studio":
    "個人資料包匯出工作室入口已預留。",

  "data-pack-manager":
    "第三方／社群資料包管理入口已預留。",

  "publish-assistant":
    "資料包格式檢查、README 與發布助手入口已預留。",

  "health-dashboard":
    "百科健康檢查入口已預留，未來負責 60,000 筆資料診斷。"
});