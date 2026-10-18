// navigation.ts -- ES module version of navigation.js
import { APP_CONFIG } from "./config";
import { i18n } from "./i18n";
import { isAllowedExternalUrl } from "./runtime-guards";

interface CardConfig {
  id: string;
  icon: string;
  title: string;
  description: string;
  url: string;
  target?: string;
  tags?: string[];
}

interface NavigationState {
  cards: CardConfig[];
  filter: string;
  filtersEnabled: boolean;
  filterTags: string[];
  filterBar: HTMLElement | null;
  maxDisplayCount: number;
  showAll: boolean;
}

const navigationState: NavigationState = {
  cards: Array.isArray(APP_CONFIG.navigationCards)
    ? APP_CONFIG.navigationCards.slice()
    : [],
  filter: "all",
  filtersEnabled: !!APP_CONFIG.enableNavigationFilters,
  filterTags: Array.isArray(APP_CONFIG.navigationFilterTags)
    ? APP_CONFIG.navigationFilterTags.filter(Boolean)
    : [],
  filterBar: null,
  maxDisplayCount: APP_CONFIG.navigationMaxDisplayCount || 6,
  showAll: APP_CONFIG.navigationShowAll || false,
};

// 检查是否启用导航功能
const navigationEnabled: boolean = !!(APP_CONFIG.enableNavigation && APP_CONFIG.navigationCards);

/**
 * 创建导航卡片元素
 * @param cardConfig 卡片配置
 * @returns 创建的卡片元素
 */
function createNavCard(cardConfig: CardConfig): HTMLAnchorElement {
  const {
    id,
    icon,
    title,
    description,
    url,
    target = "_self",
    tags,
  } = cardConfig;

  // 创建主容器
  const card = document.createElement("a");
  card.className = "nav-card";
  card.href = url && isAllowedExternalUrl(url) ? url : "#";
  card.target = target;
  if (target === "_blank") {
    card.rel = "noopener noreferrer";
  }
  card.setAttribute("data-nav-id", id);
  card.setAttribute("title", `导航到${title}`);
  if (Array.isArray(tags) && tags.length) {
    card.dataset.tags = tags.join(",");
  }

  // 创建图标
  const iconEl = document.createElement("div");
  iconEl.className = "nav-card-icon";
  iconEl.textContent = icon;

  // 创建内容容器
  const contentEl = document.createElement("div");
  contentEl.className = "nav-card-content";

  // 创建标题
  const titleEl = document.createElement("h3");
  titleEl.className = "nav-card-title";
  titleEl.textContent = title;

  // 创建描述
  const descEl = document.createElement("p");
  descEl.className = "nav-card-desc";
  descEl.textContent = description;

  // 创建箭头
  const arrowEl = document.createElement("div");
  arrowEl.className = "nav-card-arrow";
  arrowEl.textContent = "→";

  // 组装元素
  contentEl.appendChild(titleEl);
  contentEl.appendChild(descEl);
  card.appendChild(iconEl);
  card.appendChild(contentEl);
  card.appendChild(arrowEl);

  return card;
}

/**
 * 获取筛选后的卡片列表
 */
function getFilteredCards(): CardConfig[] {
  if (!navigationState.filtersEnabled || navigationState.filter === "all") {
    return navigationState.cards;
  }
  return navigationState.cards.filter((card) => {
    const tags = Array.isArray(card.tags) ? card.tags : [];
    return tags.includes(navigationState.filter);
  });
}

/**
 * 初始化导航卡片
 */
function initNavigation(): void {
  const container = document.getElementById("navCards");
  if (!container) {
    console.warn("[Navigation] 找不到导航卡片容器 #navCards");
    return;
  }

  // 显示容器并开始加载
  container.hidden = false;

  // 清空容器
  container.innerHTML = "";

  // 生成卡片
  const cards = getFilteredCards();
  const displayCards = navigationState.showAll
    ? cards
    : cards.slice(0, navigationState.maxDisplayCount);

  if (displayCards.length === 0) {
    console.warn("[Navigation] 没有配置导航卡片");
    container.classList.remove("skeleton");
    return;
  }

  const fragment = document.createDocumentFragment();
  displayCards.forEach((cardConfig) => {
    try {
      const cardElement = createNavCard(cardConfig);
      fragment.appendChild(cardElement);
    } catch (error) {
      console.error("[Navigation] 创建卡片失败:", cardConfig, error);
    }
  });

  container.appendChild(fragment);

  // 移除骨架屏，显示真实内容
  container.classList.remove("skeleton");
}

function setFilter(tag: string): void {
  navigationState.filter = tag;
  initNavigation();
  if (navigationState.filterBar) {
    const buttons =
      navigationState.filterBar.querySelectorAll(".nav-filter-btn");
    buttons.forEach((btn) => {
      btn.classList.toggle("active", (btn as HTMLElement).dataset.filter === tag);
    });
  }
}

function buildFilterBar(): void {
  if (!navigationState.filtersEnabled) return;
  const tags = navigationState.filterTags;
  if (!tags.length) return;

  const container = document.getElementById("navCards");
  if (!container || navigationState.filterBar) return;

  const bar = document.createElement("div");
  bar.className = "nav-filter-bar reveal-item";

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "nav-filter-btn active";
  allButton.dataset.filter = "all";
  allButton.textContent = i18n.t("All");
  allButton.addEventListener("click", () => setFilter("all"));
  bar.appendChild(allButton);

  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-filter-btn";
    btn.dataset.filter = tag;
    btn.textContent = tag;
    btn.addEventListener("click", () => setFilter(tag));
    bar.appendChild(btn);
  });

  container.parentNode!.insertBefore(bar, container);
  navigationState.filterBar = bar;
}

// 页面加载完成后初始化（仅当导航功能启用时）
if (navigationEnabled) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      buildFilterBar();
      initNavigation();
    });
  } else {
    buildFilterBar();
    initNavigation();
  }
}
