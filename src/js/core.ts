// core.ts -- ES module version of core.js
import { APP_CONFIG } from "./config";
import { i18n } from "./i18n";

interface ToastOptions {
  text?: string;
  duration?: number;
  id?: string;
  variant?: string;
  closable?: boolean;
  icon?: string;
}

// === Runtime 计时 ===
const START_AT: number = new Date(
  APP_CONFIG.launchDate ||
    (APP_CONFIG.meta && APP_CONFIG.meta.launchDate) ||
    "2021-02-27T00:00:00+08:00",
).getTime();
let t1: HTMLElement | null, t2: HTMLElement | null; // runtimeTimer 改为 rAF
let __rtLastSec: number = -1,
  __rtRafId: number | null = null;

function pad(n: number): string {
  return n < 10 ? "0" + n : "" + n;
}

function renderRuntime(): void {
  const diff = Date.now() - START_AT;
  const d = Math.floor(diff / 86400000);
  let rest = diff % 86400000;
  const h = Math.floor(rest / 3600000);
  rest %= 3600000;
  const m = Math.floor(rest / 60000);
  rest %= 60000;
  const s = Math.floor(rest / 1000);
  if (t1) t1.textContent = `${i18n.t("runtimePrefix")}${d}${i18n.t("runtimeSuffix")}`;
  if (t2)
    t2.textContent = `${pad(h)}${i18n.t("runtimeHour")}${pad(m)}${i18n.t("runtimeMinute")}${pad(s)}${i18n.t("runtimeSecond")}`;
}

// === Skeleton -> Fade ===
function removeSkeleton(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove("skeleton");
  [...el.children].forEach((c: Element) => ((c as HTMLElement).style.visibility = ""));
  el.classList.add("fade-in");
}

// === Reveal (IntersectionObserver) ===
function initReveal(): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll(".reveal").forEach((box) => {
      box.classList.add("reveal-in");
    });
    return;
  }
  const options = { threshold: 0.1, rootMargin: "0px 0px -5% 0px" };
  const groups = new Set<Element>();
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        const box = e.target;
        if (!box.classList.contains("reveal-in")) {
          [...box.children].forEach((ch) => {
            if (!ch.classList.contains("reveal-item"))
              ch.classList.add("reveal-item");
          });
          requestAnimationFrame(() => box.classList.add("reveal-in"));
        }
        obs.unobserve(box);
      }
    });
  }, options);
  document.querySelectorAll(".reveal").forEach((el) => {
    if (!groups.has(el)) {
      groups.add(el);
      obs.observe(el);
    }
  });
}

// === Toast (module scope, exported) ===
export function createToast(opts: ToastOptions): HTMLElement | undefined {
  if (!opts) return;
  const {
    text = "",
    duration = 2400,
    id,
    variant = "accent",
    closable = false,
    icon,
  } = opts;
  if (id && document.querySelector(`[data-toast-id="${id}"]`)) return; // 防重复
  let wrap = document.getElementById("__toast_container");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "__toast_container";
    wrap.className = "toast-container";
    wrap.setAttribute("role", "status");
    wrap.setAttribute("aria-live", "polite");
    document.body.appendChild(wrap);
  }
  // 队列上限（4 个）
  const MAX = 4;
  if (wrap.children.length >= MAX) {
    for (let i = 0; i < wrap.children.length; i++) {
      const c = wrap.children[i] as HTMLElement;
      c.classList.add("toast-leave");
      c.addEventListener("animationend", () => c.remove(), { once: true });
      break;
    }
  }
  const el = document.createElement("div");
  el.dataset.toastId = id || "";
  el.className = `toast toast-${variant}`;
  if (icon) {
    const iconSpan = document.createElement("span");
    iconSpan.className = "toast-icon";
    iconSpan.textContent = icon;
    iconSpan.setAttribute("aria-hidden", "true");
    el.appendChild(iconSpan);
  }
  const textSpan = document.createElement("span");
  textSpan.className = "toast-text";
  textSpan.textContent = text;
  el.appendChild(textSpan);
  if (closable) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-close";
    btn.setAttribute("aria-label", i18n.t("close"));
    btn.innerHTML = "×";
    btn.addEventListener("click", () => dismiss());
    el.appendChild(btn);
  }
  // 点击本体快速关闭
  el.addEventListener("click", () => dismiss());
  wrap.appendChild(el);
  // 触发入场
  requestAnimationFrame(() => el.classList.add("show"));
  const dismiss = (): void => {
    if (!el.isConnected) return;
    el.classList.remove("show");
    el.classList.add("toast-leave");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  };
  if (duration > 0) setTimeout(dismiss, duration);
  return el;
}

// === DOMContentLoaded 初始化 ===
document.addEventListener("DOMContentLoaded", () => {
  // 在线/离线状态提示
  window.addEventListener("offline", () =>
    createToast({
      text: i18n.t("networkOffline"),
      variant: "danger",
      id: "net-off",
      duration: 3000,
      icon: "📡",
    }),
  );
  window.addEventListener("online", () =>
    createToast({
      text: i18n.t("networkOnline"),
      variant: "success",
      id: "net-on",
      duration: 2500,
      icon: "✨",
    }),
  );

  // === Runtime 控制 ===
  if (APP_CONFIG.enableRuntime) {
    // 缓存 runtime DOM
    t1 = document.getElementById("timeDate");
    t2 = document.getElementById("times");
    function runtimeLoop(): void {
      if (document.hidden) {
        __rtRafId = null;
        return;
      }
      const diffSec = ((Date.now() - START_AT) / 1000) | 0;
      if (diffSec !== __rtLastSec) {
        __rtLastSec = diffSec;
        renderRuntime();
      }
      __rtRafId = requestAnimationFrame(runtimeLoop);
    }
    runtimeLoop();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && __rtRafId == null) {
        // 立刻刷新并重启循环
        __rtLastSec = -1; // 强制下一帧更新
        runtimeLoop();
      }
    });

    // skeleton remove for runtime
    const rt = document.querySelector(".runtime.skeleton") as HTMLElement | null;
    if (rt) {
      setTimeout(
        () => removeSkeleton(rt),
        APP_CONFIG.skeletonFadeDelay || 120,
      );
    }
  } else {
    // 如果禁用运行时间，隐藏运行时间元素
    const runtimeEl = document.querySelector(".runtime") as HTMLElement | null;
    if (runtimeEl) {
      runtimeEl.style.display = "none";
    }
  }

  initReveal();

  // === 彩蛋 ===
  // 1. Konami 代码 -> 显示一条控制台消息 + 小震动 + 临时彩色滤镜
  if (APP_CONFIG.enableKonami) {
    const seq: string[] = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "b",
      "a",
    ];
    let idx = 0;
    let fired = false;
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (fired) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return; // 忽略组合键
      if (e.key === seq[idx]) {
        idx++;
        if (idx === seq.length) {
          fired = true;
          konamiFire();
        }
      } else {
        idx = e.key === seq[0] ? 1 : 0;
      }
    });
    function konamiFire(): void {
      console.log(
        "%cKonami!",
        "padding:4px 8px;background:#222;color:#fff;border-radius:4px",
      );
      try {
        if (navigator.vibrate) navigator.vibrate([28, 40, 24]);
      } catch (_) {
        /* ignore */
      }
      const body = document.body;
      body.style.transition = "filter 1.2s ease";
      body.style.filter = "hue-rotate(360deg)";
      setTimeout(() => (body.style.filter = ""), 1200);
      createToast({
        text: i18n.t("konamiEasterEgg"),
        id: "konami-eg",
        variant: "accent",
        duration: 3000,
      });
    }
  }
  // 2. 标题连点 -> 切换灰度模式 / 显示提示
  if (APP_CONFIG.enableTitleClicks) {
    const title = document.getElementById("siteTitle");
    if (title) {
      let clicks: number[] = [];
      let grayscale = false;
      const need: number = APP_CONFIG.titleClickThreshold || 7;
      const win: number = APP_CONFIG.titleClickWindow || 2000;
      function prune(): void {
        const now = Date.now();
        clicks = clicks.filter((t) => now - t < win);
      }
      function toggle(): void {
        grayscale = !grayscale;
        document.documentElement.style.filter = grayscale
          ? "grayscale(1)"
          : "none";
        createToast({
          text: grayscale ? i18n.t("grayscaleModeOn") : i18n.t("grayscaleModeOff"),
          variant: "neutral",
          duration: 2000,
        });
      }
      title.addEventListener("click", () => {
        prune();
        clicks.push(Date.now());
        if (clicks.length >= need) {
          clicks = [];
          toggle();
        }
      });
    }
  }
});
