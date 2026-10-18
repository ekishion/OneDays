// src/main.ts — 唯一入口，按依赖顺序导入所有模块
import "./css/index.css";
import "./css/warmth.css";
import "./css/maomao.css";

import "./js/i18n";
import "./js/config";
import "./js/core";
import "./js/theme";
import "./js/navigation";
import "./js/loader";
import "./js/app-init";
// === 懒加载模块 ===
import { APP_CONFIG } from "./js/config";
import { i18n } from "./js/i18n";

function idle(fn: () => void): void {
  if ("requestIdleCallback" in window) requestIdleCallback(fn, { timeout: 2500 });
  else setTimeout(fn, 1200);
}

// 300ms 后加载公告和问候语
setTimeout(() => {
  import("./js/announcement");
  import("./js/greeting");
}, 300);

// 空闲时加载猫咪动画和右键限制
idle(() => {
  import("./js/maomao");
  import("./js/no-copy");
});

// 空闲时加载更新检查和额外功能
idle(() => {
  import("./js/update-check");
  import("./js/extras");
});

// 一言：IntersectionObserver + 空闲兜底
if (APP_CONFIG.enableHitokoto !== false) {
  const hitokotoEl = document.getElementById("hitokoto");
  if (hitokotoEl) {
    let loaded = false;
    const trigger = () => {
      if (loaded) return;
      loaded = true;
      import("./js/hitokoto").catch(() => {
        const link = document.getElementById("hitokoto_text");
        if (link) {
          link.textContent = i18n.t("hitokotoError");
          hitokotoEl.classList.remove("skeleton");
        }
      });
      obs?.disconnect();
    };
    const obs = "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => { if (entries.some((e) => e.isIntersecting)) trigger(); },
          { rootMargin: "50px" },
        )
      : null;
    if (obs) obs.observe(hitokotoEl);
    idle(trigger);
    setTimeout(() => { if (!loaded && document.visibilityState === "visible") trigger(); }, 10000);
  }
} else {
  const hitokotoEl = document.getElementById("hitokoto");
  if (hitokotoEl) hitokotoEl.remove();
}
