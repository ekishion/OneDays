import { APP_CONFIG } from "./config";
import { i18n } from "./i18n";
import { readStorage, writeStorage } from "./runtime-guards";

/* ------------------------------------------------------------------ */
/*  Constants & configuration                                         */
/* ------------------------------------------------------------------ */

const root: HTMLElement = document.documentElement;
const THEME_KEY = "onedays-theme";
const ACC_KEY = "onedays-accent";

const toggleBtn: HTMLElement | null = document.getElementById("themeToggle");
const accents: string[] = Array.isArray(APP_CONFIG.accents)
  ? APP_CONFIG.accents
  : [];
const defaultAccentIndex: number =
  Number.parseInt(APP_CONFIG.defaultAccentIndex ?? 0, 10) || 0;

let accentIdx: number =
  Number.parseInt(readStorage(ACC_KEY, String(defaultAccentIndex)) ?? String(defaultAccentIndex), 10) ||
  0;
let autoTimer: number | null = null;

const LONG_PRESS_DELAY = 550;
const DOUBLE_TAP_INTERVAL = 400;

let pressTimer: number | null = null;
let longPressTriggered = false;
let skipNextClick = false;

/* ------------------------------------------------------------------ */
/*  Language-panel element references                                  */
/* ------------------------------------------------------------------ */

let langPanel: HTMLDivElement | null = null;
let langHeader: HTMLDivElement | null = null;
let langHint: HTMLDivElement | null = null;
let langThemeRow: HTMLDivElement | null = null;
let langThemeTitle: HTMLDivElement | null = null;
let langThemeActions: HTMLDivElement | null = null;
let langList: HTMLDivElement | null = null;
let langAccentRow: HTMLDivElement | null = null;
let langAccentTitle: HTMLDivElement | null = null;
let langAccentList: HTMLDivElement | null = null;

/* ------------------------------------------------------------------ */
/*  Translation helper (delegates to i18n.t)                          */
/* ------------------------------------------------------------------ */

const translate = (key: string, fallback?: string): string =>
  i18n.t(key, fallback ?? key);

/* ------------------------------------------------------------------ */
/*  Theme mode options                                                */
/* ------------------------------------------------------------------ */

interface ModeOption {
  mode: string;
  icon: string;
  label: string;
}

const MODE_OPTIONS: ModeOption[] = [
  { mode: "auto", icon: "\u{1F313}", label: "languageThemeAuto" },
  { mode: "light", icon: "\u{1F324}", label: "languageThemeLight" },
  { mode: "dark", icon: "\u{1F4A4}", label: "languageThemeDark" },
];

/* ------------------------------------------------------------------ */
/*  Accent panel                                                      */
/* ------------------------------------------------------------------ */

const accentPanelEnabled: boolean =
  APP_CONFIG.enableAccentPanel !== false && accents.length > 1;

/* ------------------------------------------------------------------ */
/*  Accent auto-rotate                                                */
/* ------------------------------------------------------------------ */

interface ScheduleEntry {
  minutes: number;
  index: number;
}

const autoRotateEnabled: boolean = !!APP_CONFIG.enableAccentAutoRotate;
const autoRotateSchedule: ScheduleEntry[] = parseSchedule(
  APP_CONFIG.accentRotateSchedule,
);

function parseSchedule(raw: unknown): ScheduleEntry[] {
  if (!autoRotateEnabled) return [];
  if (!raw || typeof raw !== "object") return [];

  const namedSlots: Record<string, number> = {
    midnight: 0,
    dawn: 5 * 60 + 30,
    morning: 9 * 60,
    noon: 12 * 60,
    afternoon: 15 * 60,
    dusk: 18 * 60,
    evening: 20 * 60,
    night: 22 * 60,
  };

  const entries: ScheduleEntry[] = [];
  for (const [timeKey, indexValue] of Object.entries(raw as Record<string, unknown>)) {
    const index = Number.parseInt(indexValue as string, 10);
    if (!Number.isFinite(index)) continue;

    let minutes: number | null = null;
    if (typeof timeKey === "number") {
      minutes = timeKey;
    } else if (typeof timeKey === "string") {
      const key = timeKey.trim().toLowerCase();
      if (/^\d{1,2}:\d{2}$/.test(key)) {
        const [h, m] = key.split(":").map(Number);
        minutes = (h * 60 + m) % (24 * 60);
      } else if (/^\d+$/.test(key)) {
        minutes = Number(key) % (24 * 60);
      } else if (key in namedSlots) {
        minutes = namedSlots[key];
      }
    }

    if (minutes == null) continue;
    const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
    entries.push({ minutes: normalized, index });
  }

  entries.sort((a, b) => a.minutes - b.minutes);
  return entries;
}

/* ------------------------------------------------------------------ */
/*  Accent management                                                 */
/* ------------------------------------------------------------------ */

interface SetAccentOpts {
  persist?: boolean;
  updateBtn?: boolean;
}

function setAccent(i: number, opts: SetAccentOpts = {}): void {
  if (!accents.length) return;
  accentIdx = (i + accents.length) % accents.length;
  const accent = accents[accentIdx];
  root.style.setProperty("--accent", accent);
  // 使用 color-mix 生成 hover 色，兼容所有颜色格式
  root.style.setProperty(
    "--accent-hover",
    `color-mix(in srgb, ${accent} 85%, #000)`,
  );
  if (toggleBtn) {
    toggleBtn.setAttribute("data-accent", String(accentIdx));
  }
  if (opts.persist !== false) {
    writeStorage(ACC_KEY, String(accentIdx));
  }
  refreshAccentButtons();
  if (opts.updateBtn !== false) {
    updateBtn();
  }
}

function applyAccentByTime(now: Date = new Date()): void {
  if (!autoRotateSchedule.length) return;
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  let candidate: ScheduleEntry = autoRotateSchedule[autoRotateSchedule.length - 1];
  for (const entry of autoRotateSchedule) {
    if (entry.minutes <= minutesNow) {
      candidate = entry;
    } else {
      break;
    }
  }

  if (candidate) {
    setAccent(candidate.index);
  }
}

function scheduleNextRotate(now: Date = new Date()): void {
  if (!autoRotateSchedule.length) return;
  if (autoTimer) clearTimeout(autoTimer);

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const secondsNow = now.getSeconds();
  const msNow = now.getMilliseconds();

  let next: ScheduleEntry | undefined = autoRotateSchedule.find(
    (entry) => entry.minutes > minutesNow,
  );
  if (!next) {
    next = autoRotateSchedule[0];
  }

  const totalNowMs = minutesNow * 60 * 1000 + secondsNow * 1000 + msNow;
  let targetMs = next.minutes * 60 * 1000;
  if (targetMs <= totalNowMs) {
    targetMs += 24 * 60 * 60 * 1000; // next day
  }

  const delay = Math.max(1000, targetMs - totalNowMs);
  autoTimer = window.setTimeout(() => {
    applyAccentByTime();
    scheduleNextRotate();
  }, delay);
}

function initAutoRotate(): void {
  if (!autoRotateSchedule.length) return;
  applyAccentByTime();
  scheduleNextRotate();
}

setAccent(accentIdx, { updateBtn: false });

/* ------------------------------------------------------------------ */
/*  Theme mode management                                             */
/* ------------------------------------------------------------------ */

const mqlDark: MediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
const sysDark = (): boolean => mqlDark.matches;

let savedMode: string = readStorage(THEME_KEY) || "";
if (!savedMode) {
  savedMode = "auto";
  writeStorage(THEME_KEY, savedMode);
}

function applyEffective(): void {
  const dark = sysDark();
  if (savedMode === "auto") {
    root.setAttribute("data-theme", dark ? "dark" : "light");
  } else {
    root.setAttribute("data-theme", savedMode);
  }
}

function currentEffective(): string | null {
  return root.getAttribute("data-theme");
}

function updateBtn(): void {
  if (!toggleBtn) return;
  const effective = currentEffective();
  let icon = "\u{1F313}";
  if (savedMode === "auto") {
    icon = effective === "dark" ? "\u{1F4A4}" : "\u{1F4BB}";
  } else {
    icon = effective === "dark" ? "\u{1F324}" : "\u{1F313}";
  }
  toggleBtn.textContent = icon;
  toggleBtn.title =
    "主题: " + (savedMode === "auto" ? "自动(" + effective + ")" : effective);
  toggleBtn.setAttribute("aria-label", toggleBtn.title);
  (toggleBtn as HTMLElement).dataset.mode = savedMode;
  toggleBtn.setAttribute("data-accent", String(accentIdx));
}

// 遮罩动画：先显示遮罩，再应用变化，最后淡出
function withThemeMask(apply: () => void): void {
  const mask = document.getElementById("themeMask");
  if (mask) {
    (mask as HTMLDivElement).hidden = false;
    requestAnimationFrame(() => mask.classList.add("show"));
  }
  setTimeout(() => {
    apply();
    if (mask) {
      setTimeout(() => {
        mask.classList.remove("show");
        setTimeout(() => ((mask as HTMLDivElement).hidden = true), 300);
      }, 100);
    }
  }, 50);
}

function applyThemeMode(mode: string): void {
  if (!MODE_OPTIONS.some((item) => item.mode === mode)) return;
  withThemeMask(() => {
    savedMode = mode;
    writeStorage(THEME_KEY, savedMode);
    applyEffective();
    updateBtn();
    refreshThemeButtons();
  });
}

export function cycleThemeMode(): void {
  const order = MODE_OPTIONS.map((item) => item.mode);
  const idx = order.indexOf(savedMode);
  const next = order[(idx + 1) % order.length];
  applyThemeMode(next);
}

applyEffective();
updateBtn();

/* ------------------------------------------------------------------ */
/*  Toggle button interaction                                         */
/* ------------------------------------------------------------------ */

let lastTap = 0;
if (toggleBtn) {
  toggleBtn.addEventListener("pointerdown", handlePointerDown);
  toggleBtn.addEventListener("pointerup", handlePointerUp);
  toggleBtn.addEventListener("pointerleave", clearPressTimer);
  toggleBtn.addEventListener("pointercancel", clearPressTimer);
  toggleBtn.addEventListener("click", handleClick, true);
}

function handleClick(event: MouseEvent): void {
  if (skipNextClick) {
    event.preventDefault();
    event.stopImmediatePropagation();
    skipNextClick = false;
    return;
  }

  const now = Date.now();
  if (now - lastTap < DOUBLE_TAP_INTERVAL) {
    setAccent(accentIdx + 1);
    scheduleNextRotate();
    lastTap = 0;
    return;
  }

  lastTap = now;
  cycleThemeMode();
}

function handlePointerDown(event: PointerEvent): void {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }
  if (event.pointerType === "touch") {
    event.preventDefault();
  }
  longPressTriggered = false;
  clearPressTimer();
    pressTimer = window.setTimeout(() => {
      longPressTriggered = true;
      skipNextClick = true;
      if (isLanguagePanelOpen()) hideLanguagePanel();
      else showLanguagePanel();
    }, LONG_PRESS_DELAY);
}

function handlePointerUp(event: PointerEvent): void {
  if (
    event.button !== undefined &&
    event.button !== 0 &&
    event.pointerType !== "touch" &&
    event.pointerType !== "pen"
  ) {
    clearPressTimer();
    return;
  }
  clearPressTimer();
  if (longPressTriggered) {
    window.setTimeout(() => {
      skipNextClick = false;
    }, 0);
  }
}

function clearPressTimer(): void {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
}

/* ------------------------------------------------------------------ */
/*  System dark-mode listener                                         */
/* ------------------------------------------------------------------ */

const darkListener = (): void => {
  if (savedMode === "auto") {
    withThemeMask(() => {
      applyEffective();
      updateBtn();
    });
  }
};

if (typeof mqlDark.addEventListener === "function") {
  mqlDark.addEventListener("change", darkListener);
} else if (typeof (mqlDark as any).addListener === "function") {
  (mqlDark as any).addListener(darkListener);
}

/* ------------------------------------------------------------------ */
/*  Language panel helpers                                             */
/* ------------------------------------------------------------------ */

function isLanguagePanelOpen(): boolean {
  return !!(
    langPanel &&
    !(langPanel as HTMLDivElement).hidden &&
    langPanel.classList.contains("open")
  );
}

function ensureLanguagePanel(): HTMLDivElement {
  if (langPanel) return langPanel;

  // 创建面板容器
  langPanel = document.createElement("div");
  langPanel.className = "theme-lang-panel";
  langPanel.hidden = true;
  langPanel.setAttribute("role", "menu");
  langPanel.setAttribute(
    "aria-label",
    translate("languagePickerTitle", "Choose language"),
  );

  // 使用DocumentFragment优化DOM操作
  const fragment = document.createDocumentFragment();

  // 创建面板各部分
  langHeader = createPanelElement("div", "theme-lang-header");
  fragment.appendChild(langHeader);

  langHint = createPanelElement("div", "theme-lang-hint");
  fragment.appendChild(langHint);

  // 主题选择区域
  const themeSection = createThemeSection();
  fragment.appendChild(themeSection);

  // 强调色选择区域（如果启用）
  if (accentPanelEnabled) {
    const accentSection = createAccentSection();
    fragment.appendChild(accentSection);
  }

  // 语言选择区域
  langList = createPanelElement("div", "theme-lang-list");
  fragment.appendChild(langList);

  langPanel.appendChild(fragment);
  document.body.appendChild(langPanel);

  // 绑定语言变化事件
  window.addEventListener("languageChanged", handleLanguageChange as EventListener);

  return langPanel;
}

// 辅助函数：创建面板元素
function createPanelElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  textContent = "",
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
}

// 创建主题选择区域
function createThemeSection(): HTMLDivElement {
  const section = createPanelElement("div", "theme-lang-theme");

  langThemeTitle = createPanelElement("div", "theme-lang-theme-title");
  section.appendChild(langThemeTitle);

  langThemeActions = createPanelElement("div", "theme-lang-theme-actions");
  section.appendChild(langThemeActions);

  return section;
}

// 创建强调色选择区域
function createAccentSection(): HTMLDivElement {
  const section = createPanelElement("div", "theme-lang-accent");

  langAccentTitle = createPanelElement("div", "theme-lang-accent-title");
  section.appendChild(langAccentTitle);

  langAccentList = createPanelElement("div", "theme-lang-accent-list");
  section.appendChild(langAccentList);

  return section;
}

// 处理语言变化
function handleLanguageChange(): void {
  updateLanguagePanelTexts();
  if (langPanel && !langPanel.hidden) {
    renderLanguagePanel();
  }
}

function updateLanguagePanelTexts(): void {
  if (!langPanel) return;
  if (langHeader)
    langHeader.textContent = translate(
      "languagePickerTitle",
      "Choose language",
    );
  if (langHint)
    langHint.textContent = translate(
      "languagePickerHint",
      "Tap an option to switch immediately.",
    );
  if (langThemeTitle)
    langThemeTitle.textContent = translate(
      "languageThemeTitle",
      "Theme mode",
    );
  if (langAccentTitle)
    langAccentTitle.textContent = translate(
      "languageAccentTitle",
      "Accent color",
    );
  langPanel?.setAttribute(
    "aria-label",
    translate("languagePickerTitle", "Choose language"),
  );
}

function renderLanguagePanel(): HTMLDivElement {
  const panel = ensureLanguagePanel();
  updateLanguagePanelTexts();

  // 并行渲染各个部分
  renderThemeOptions();
  if (accentPanelEnabled) {
    renderAccentOptions();
  }

  renderLanguageOptions();

  return panel;
}

/* ------------------------------------------------------------------ */
/*  Language options rendering                                        */
/* ------------------------------------------------------------------ */

function renderLanguageOptions(): void {
  if (!langList) return;

  const languages = i18n.getAvailableLanguages();
  const currentLang = i18n.getCurrentLanguage();

  if (!languages.length) {
    const empty = createPanelElement(
      "div",
      "theme-lang-empty",
      translate("languagePickerEmpty", "No languages available"),
    );
    langList.innerHTML = "";
    langList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  languages.forEach(({ code, name }: { code: string; name: string }) => {
    const option = createLanguageOption(code, name, currentLang);
    fragment.appendChild(option);
  });

  langList.innerHTML = "";
  langList.appendChild(fragment);
}

// 创建语言选项
function createLanguageOption(
  code: string,
  name: string,
  currentLang: string | null,
): HTMLButtonElement {
  const option = document.createElement("button");
  option.type = "button";
  option.className = "theme-lang-option";
  option.dataset.lang = code;
  option.setAttribute("role", "menuitemradio");
  option.setAttribute(
    "aria-checked",
    code === currentLang ? "true" : "false",
  );

  // 使用DocumentFragment创建选项内容
  const optionFragment = document.createDocumentFragment();

  const dot = createPanelElement("span", "theme-lang-dot");
  optionFragment.appendChild(dot);

  const label = createPanelElement("span", "theme-lang-name", name);
  optionFragment.appendChild(label);

  const codeTag = createPanelElement("span", "theme-lang-code", code);
  optionFragment.appendChild(codeTag);

  if (code === currentLang) {
    option.classList.add("active");
    const badge = createPanelElement(
      "span",
      "theme-lang-current",
      translate("languageCurrentTag", "Current"),
    );
    optionFragment.appendChild(badge);
  }

  option.appendChild(optionFragment);

  option.addEventListener("click", () => {
    i18n.setLanguage(code);
    hideLanguagePanel();
    updateBtn();
  });

  return option;
}

/* ------------------------------------------------------------------ */
/*  Theme & accent option rendering                                   */
/* ------------------------------------------------------------------ */

function renderThemeOptions(): void {
  if (!langThemeActions) return;

  const fragment = document.createDocumentFragment();

  MODE_OPTIONS.forEach(({ mode, icon, label }) => {
    const btn = createThemeButton(mode, icon, label);
    fragment.appendChild(btn);
  });

  langThemeActions.innerHTML = "";
  langThemeActions.appendChild(fragment);
  refreshThemeButtons();
}

// 创建主题按钮
function createThemeButton(
  mode: string,
  icon: string,
  label: string,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "theme-lang-theme-btn";
  btn.dataset.mode = mode;
  btn.setAttribute("aria-pressed", "false");

  // 使用DocumentFragment创建按钮内容
  const btnFragment = document.createDocumentFragment();

  const iconSpan = createPanelElement("span", "theme-lang-theme-icon", icon);
  btnFragment.appendChild(iconSpan);

  const textSpan = createPanelElement(
    "span",
    "theme-lang-theme-text",
    translate(label, mode),
  );
  btnFragment.appendChild(textSpan);

  btn.appendChild(btnFragment);

  btn.addEventListener("click", () => applyThemeMode(mode));

  return btn;
}

function renderAccentOptions(): void {
  if (!accentPanelEnabled || !langAccentList) return;

  const fragment = document.createDocumentFragment();

  accents.forEach((color: string, idx: number) => {
    const btn = createAccentButton(color, idx);
    fragment.appendChild(btn);
  });

  langAccentList.innerHTML = "";
  langAccentList.appendChild(fragment);
  refreshAccentButtons();
}

// 创建强调色按钮
function createAccentButton(color: string, idx: number): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "theme-lang-accent-dot";
  btn.dataset.index = String(idx);
  btn.setAttribute("aria-pressed", "false");
  btn.setAttribute(
    "aria-label",
    `${translate("languageAccentOption", "Accent color")} ${idx + 1}`,
  );
  btn.style.setProperty("--swatch-color", color);
  btn.title = color;

  btn.addEventListener("click", () => {
    if (accentIdx === idx) return;
    setAccent(idx);
    scheduleNextRotate();
  });

  return btn;
}

function refreshThemeButtons(): void {
  if (!langThemeActions) return;
  langThemeActions
    .querySelectorAll<HTMLButtonElement>(".theme-lang-theme-btn")
    .forEach((btn) => {
      const active = btn.dataset.mode === savedMode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
}

function refreshAccentButtons(): void {
  if (!accentPanelEnabled || !langAccentList) return;
  langAccentList
    .querySelectorAll<HTMLButtonElement>(".theme-lang-accent-dot")
    .forEach((btn) => {
      const index = Number.parseInt(btn.dataset.index ?? "-1", 10);
      const active = index === accentIdx;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
}

/* ------------------------------------------------------------------ */
/*  Language panel show / hide / position                             */
/* ------------------------------------------------------------------ */

function showLanguagePanel(): void {
  const panel = renderLanguagePanel();
  panel.hidden = false;
  refreshAccentButtons();
  positionLanguagePanel();

  requestAnimationFrame(() => {
    panel.classList.add("open");
    // 将焦点设置到面板的第一个可聚焦元素
    const firstFocusable = getFocusableElements()[0];
    if (firstFocusable) {
      firstFocusable.focus();
    }
  });

  document.addEventListener("pointerdown", handleOutsidePress, true);
  document.addEventListener("keydown", handlePanelKeydown, true);
  window.addEventListener("resize", positionLanguagePanel);
  window.addEventListener("scroll", handlePanelScroll, true);
}

function hideLanguagePanel(): void {
  if (!langPanel || langPanel.hidden) return;

  langPanel.classList.remove("open");

  document.removeEventListener("pointerdown", handleOutsidePress, true);
  document.removeEventListener("keydown", handlePanelKeydown, true);
  window.removeEventListener("resize", positionLanguagePanel);
  window.removeEventListener("scroll", handlePanelScroll, true);

  setTimeout(() => {
    if (langPanel && !langPanel.classList.contains("open")) {
      langPanel.hidden = true;
    }
  }, 200);
}

function positionLanguagePanel(): void {
  if (!langPanel || langPanel.hidden || !toggleBtn) return;
  const rect = toggleBtn.getBoundingClientRect();
  const margin = 16;
  const gap = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const panelHeight =
    langPanel.offsetHeight ||
    langPanel.scrollHeight ||
    langPanel.getBoundingClientRect().height ||
    0;
  let top = rect.bottom + gap;
  let showAbove = false;
  const fitsBelow = top + panelHeight <= viewportHeight - margin;
  if (!fitsBelow) {
    const aboveTop = rect.top - panelHeight - gap;
    if (aboveTop >= margin) {
      top = aboveTop;
      showAbove = true;
    } else {
      top = Math.max(margin, viewportHeight - panelHeight - margin);
    }
  } else {
    top = Math.max(margin, top);
  }
  const centerX = rect.left + rect.width / 2;
  const clampedCenter = Math.min(
    viewportWidth - margin,
    Math.max(margin, centerX),
  );
  langPanel.style.top = `${top}px`;
  langPanel.style.left = `${clampedCenter}px`;
  langPanel.classList.toggle("theme-lang-panel--above", showAbove);
}

function handleOutsidePress(event: PointerEvent): void {
  if (!langPanel) return;
  if (
    langPanel.contains(event.target as Node) ||
    toggleBtn?.contains(event.target as Node)
  )
    return;
  hideLanguagePanel();
}

function handlePanelKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    hideLanguagePanel();
    return;
  }

  // 增强键盘导航
  const focusableElements = getFocusableElements();
  const currentIndex = focusableElements.indexOf(
    document.activeElement as HTMLElement,
  );

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      focusNextElement(focusableElements, currentIndex);
      break;
    case "ArrowUp":
      event.preventDefault();
      focusPreviousElement(focusableElements, currentIndex);
      break;
    case "Home":
      event.preventDefault();
      focusableElements[0]?.focus();
      break;
    case "End":
      event.preventDefault();
      focusableElements[focusableElements.length - 1]?.focus();
      break;
    case "Tab":
      // 允许Tab键在面板内循环
      if (event.shiftKey) {
        if (currentIndex === 0) {
          event.preventDefault();
          focusableElements[focusableElements.length - 1]?.focus();
        }
      } else {
        if (currentIndex === focusableElements.length - 1) {
          event.preventDefault();
          focusableElements[0]?.focus();
        }
      }
      break;
  }
}

// 获取面板内所有可聚焦元素
function getFocusableElements(): HTMLElement[] {
  if (!langPanel) return [];
  return Array.from(
    langPanel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"),
  );
}

// 聚焦下一个元素
function focusNextElement(elements: HTMLElement[], currentIndex: number): void {
  const nextIndex = (currentIndex + 1) % elements.length;
  elements[nextIndex]?.focus();
}

// 聚焦上一个元素
function focusPreviousElement(
  elements: HTMLElement[],
  currentIndex: number,
): void {
  const prevIndex =
    currentIndex <= 0 ? elements.length - 1 : currentIndex - 1;
  elements[prevIndex]?.focus();
}

/* ------------------------------------------------------------------ */
/*  Bootstrap                                                         */
/* ------------------------------------------------------------------ */

initAutoRotate();

function handlePanelScroll(): void {
  hideLanguagePanel();
}
