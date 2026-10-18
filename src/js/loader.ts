import { APP_CONFIG } from './config';

const cfg = APP_CONFIG || {};

if (!cfg.enableSplash) {
  const splashEl = document.getElementById('splash');
  splashEl && splashEl.remove();
} else {
  const splash = document.getElementById('splash');
  if (splash) {
    ensureSplashStructure(splash, cfg);

    const bar = splash.querySelector('.splash-matrix-progress-fill') as HTMLElement | null;
    const title = splash.querySelector('.splash-matrix-progress-text') as HTMLElement | null;

    const resources = [
      ...document.querySelectorAll(
        'link[rel="stylesheet"], link[rel="manifest"], script[defer], script[type="module"]',
      ),
    ].filter((el) => (el as HTMLScriptElement).src || (el as HTMLLinkElement).href);

    const urls = [...new Set(resources.map((r) => (r as HTMLScriptElement).src || (r as HTMLLinkElement).href))];
    const total: number = urls.length || 1;
    let loaded: number = 0;

    const updateProgress = (): void => {
      loaded = Math.min(loaded, total);
      const percent = Math.round((loaded / total) * 100);
      requestAnimationFrame(() => {
        if (bar) {
          bar.style.width = percent + '%';
        }
        if (title) {
          title.textContent =
            percent < 100 ? 'Loading ' + percent + '%' : 'Ready';
        }
      });
    };

    updateProgress();

    urls.forEach((url) => {
      const element = resources.find((r) => ((r as HTMLScriptElement).src || (r as HTMLLinkElement).href) === url);
      if (!element) {
        loaded++;
        updateProgress();
        return;
      }

      let settled = false;
      const cleanup = (): void => {
        element.removeEventListener('load', markLoaded);
        element.removeEventListener('error', markLoaded);
      };

      const markLoaded = (): void => {
        if (settled) return;
        settled = true;
        loaded++;
        updateProgress();
        cleanup();
      };

      element.addEventListener('load', markLoaded);
      element.addEventListener('error', markLoaded);

      const hasResourceTiming = performance.getEntriesByName(url).some(
        (entry) =>
          entry.entryType === 'resource' &&
          Boolean((entry as PerformanceResourceTiming).initiatorType),
      );
      const isLoadedStylesheet =
        element instanceof HTMLLinkElement &&
        element.relList.contains('stylesheet') &&
        element.sheet !== null;
      if (hasResourceTiming || isLoadedStylesheet) {
        markLoaded();
      }
    });

    window.addEventListener('beforeunload', () => {
      const splashEl = document.getElementById('splash');
      if (splashEl) {
        const container = splashEl.querySelector('.splash-matrix') as HTMLElement | null;
        if (container && (container as any)._cleanupAnimation) {
          (container as any)._cleanupAnimation();
        }
      }
    });
  }
}

function ensureSplashStructure(root: HTMLElement, config: Record<string, any>): void {
  if (root.dataset.enhanced === 'true') return;

  root.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'splash-matrix';

  const header = document.createElement('div');
  header.className = 'splash-matrix-header';

  const title = document.createElement('div');
  title.className = 'splash-matrix-title';
  const titleText: string =
    config.splashHeading ||
    config.title ||
    '忆窝';
  title.textContent = titleText;

  const subtitle = document.createElement('div');
  subtitle.className = 'splash-matrix-subtitle';
  const subtitleText: string =
    config.splashSubheading ||
    'Digital dreams are loading…';
  subtitle.textContent = subtitleText;

  header.appendChild(title);
  header.appendChild(subtitle);

  const rain = document.createElement('div');
  rain.className = 'splash-matrix-rain';

  const COLS = 8;
  const CHARS_PER_COL = 8;
  for (let i = 0; i < COLS; i++) {
    const column = document.createElement('div');
    column.className = 'splash-matrix-column';
    column.style.left = `${(i / COLS) * 100}%`;
    column.style.animationDelay = `${Math.random() * 2}s`;

    for (let j = 0; j < CHARS_PER_COL; j++) {
      const char = document.createElement('span');
      char.className = 'splash-matrix-char';
      char.textContent = getRandomChar();
      char.style.animationDelay = `${j * 0.1 + Math.random() * 0.5}s`;
      column.appendChild(char);
    }

    rain.appendChild(column);
  }

  const progress = document.createElement('div');
  progress.className = 'splash-matrix-progress';

  const progressText = document.createElement('div');
  progressText.className = 'splash-matrix-progress-text';
  progressText.dataset.i18n = 'loadingProgress';
  progressText.textContent = 'Loading...';

  const progressBar = document.createElement('div');
  progressBar.className = 'splash-matrix-progress-bar';
  const progressFill = document.createElement('div');
  progressFill.className = 'splash-matrix-progress-fill';
  progressBar.appendChild(progressFill);

  progress.appendChild(progressText);
  progress.appendChild(progressBar);

  container.appendChild(header);
  container.appendChild(rain);
  container.appendChild(progress);

  root.appendChild(container);
  root.dataset.enhanced = 'true';

  startCharAnimation(container);
}

function getRandomChar(): string {
  const chars = 'CRYCHICは壊れになってしまいましたわ';
  return chars[Math.floor(Math.random() * chars.length)];
}

function startCharAnimation(container: HTMLElement): void {
  const chars = container.querySelectorAll('.splash-matrix-char');
  let rafId: number | null = null;
  let observer: MutationObserver | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastUpdate: number = 0;
  const THROTTLE = 120;

  const updateChars = (now: number): void => {
    if (now - lastUpdate >= THROTTLE) {
      lastUpdate = now;
      for (let i = 0; i < chars.length; i++) {
        if (Math.random() < 0.03) {
          chars[i].textContent = getRandomChar();
          (chars[i] as HTMLElement).style.opacity = String(Math.random() * 0.5 + 0.5);
        }
      }
    }
    rafId = requestAnimationFrame(updateChars);
  };

  const cleanup = (): void => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  rafId = requestAnimationFrame(updateChars);

  observer = new MutationObserver(() => {
    if (container.closest('.splash.fade-out')) {
      cleanup();
    }
  });

  if (container.parentElement) {
    observer.observe(container.parentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  timeout = setTimeout(cleanup, 10000);

  (container as any)._cleanupAnimation = cleanup;
}
