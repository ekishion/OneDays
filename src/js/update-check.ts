import { APP_CONFIG } from './config';
import { i18n } from './i18n';
import { createToast } from './core';
import { appendQuery, isOwnedCacheKey, isOwnedServiceWorkerScope, readStorage, writeStorage } from './runtime-guards';

interface StorageKeys {
  version: string;
  lastUpdate: string;
  gapList: string;
}

interface AppState {
  storedVersion: string;
  lastUpdate: number;
  gapList: string[];
  inFlight: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

const ENABLED: boolean = APP_CONFIG.enableUpdateCheck !== false;

const VERSION: string = APP_CONFIG.version || 'dev';
const SOURCE: string = APP_CONFIG.updateSource || '/version.json';
const CHECK_INTERVAL: number = APP_CONFIG.updateCheckInterval || 300000;
const NOTIFY_DELAY: number = APP_CONFIG.updateNotifyDelay || 0;
// 静默期与重试参数没有配置入口，恒为默认值
const QUIET_WINDOW = 300000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 400;

const STORAGE_KEYS: StorageKeys = {
  version: 'onedays-version',
  lastUpdate: 'onedays-last-update',
  gapList: 'onedays-version-gap',
};

function readGapList(): string[] {
  const raw = readStorage(STORAGE_KEYS.gapList);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[Update] Failed to parse gap list:', err);
    return [];
  }
}

const announcer = {
  push(text: string | Record<string, any>): void {
    if ((APP_CONFIG as any).enableAnnouncement === false) {
      console.log('[Update] Announcement disabled, skip:', text);
      return;
    }
    const payload =
      typeof text === 'string'
        ? { text, isUpdate: true }
        : { ...text, isUpdate: true };
    const announceAdd = (window as any).__announceAdd;
    if (typeof announceAdd === 'function') {
      announceAdd(payload, {
        priority: 'front',
        updateMessage: true,
      });
    } else {
      (window as any).__ANN_PENDING = (window as any).__ANN_PENDING || [];
      (window as any).__ANN_PENDING.unshift(payload);
    }
  },
};

const splashActive = (): boolean => {
  const splash = document.getElementById('splash');
  return !!(splash && !splash.classList.contains('fade-out'));
};

const cacheCleaner = {
  async flushOwnedCaches(): Promise<void> {
    // 清除 CacheStorage
    if ('caches' in window) {
      try {
        const keys = await window.caches.keys();
        await Promise.allSettled(
          keys.filter(isOwnedCacheKey).map((key) => window.caches.delete(key)),
        );
      } catch (err) {
        console.warn('[Update] CacheStorage cleanup failed:', err);
      }
    }

    // 注销 Service Worker 以确保下次加载全新资源
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        const appScope = new URL('./', window.location.href).href;
        await Promise.allSettled(
          regs
            .filter((r) => isOwnedServiceWorkerScope(r.scope, appScope))
            .map((r) => r.unregister()),
        );
      } catch (err) {
        console.warn('[Update] SW unregister failed:', err);
      }
    }
  },
};

const state: AppState = {
  storedVersion: readStorage(STORAGE_KEYS.version) || VERSION,
  lastUpdate: parseInt(readStorage(STORAGE_KEYS.lastUpdate) || '0', 10) || 0,
  gapList: readGapList(),
  inFlight: false,
  timer: null,
};

if (!readStorage(STORAGE_KEYS.version)) {
  writeStorage(STORAGE_KEYS.version, state.storedVersion);
}

function persistGapList(): void {
  const limited = state.gapList.slice(-6);
  writeStorage(STORAGE_KEYS.gapList, JSON.stringify(limited));
}

function buildGapInfo(): string {
  if (state.gapList.length <= 1) return '';
  return (
    ' ' +
    i18n.t('updateCumulative') +
    ' ' +
    state.gapList.length +
    ' ' +
    i18n.t('updateVersionSpan')
  );
}

async function fetchRemoteVersion(attempt: number = 0): Promise<string | null> {
  const url = appendQuery(SOURCE, { v: Date.now() });
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = JSON.parse(await response.text()) as { version?: string };
    return data.version || null;
  } catch (err) {
    if (attempt + 1 >= MAX_RETRIES) return null;
    const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchRemoteVersion(attempt + 1);
  }
}

async function applyUpdate(): Promise<void> {
  const stamp = Date.now();
  writeStorage(STORAGE_KEYS.version, 'pending-' + stamp);
  writeStorage(STORAGE_KEYS.lastUpdate, stamp.toString());
  state.lastUpdate = stamp;

  await cacheCleaner.flushOwnedCaches();

  const url = new URL(window.location.href);
  url.searchParams.set('v', stamp.toString());

  window.location.replace(url.toString());
}

function scheduleNext(): void {
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(checkForUpdate, CHECK_INTERVAL);
}

function shouldDeferByQuietWindow(): boolean {
  return Date.now() - state.lastUpdate < QUIET_WINDOW;
}

function queueGap(version: string): void {
  const last = state.gapList[state.gapList.length - 1];
  if (last === version) return;
  state.gapList.push(version);
  persistGapList();
}

function proceed(remoteVersion: string): void {
  if (shouldDeferByQuietWindow()) {
    announcer.push(
      i18n.t('updateNewVersion') +
        ' ' +
        remoteVersion +
        ' ' +
        i18n.t('updateQuietPeriod'),
    );
    createToast({
      text: i18n.t('updateNewVersion') + ' ' + remoteVersion,
      variant: 'accent',
      icon: '🔄',
      id: 'update-defer',
      duration: 4000,
    });
    scheduleNext();
    return;
  }

  const runRefresh = (): void => {
    announcer.push(
      i18n.t('updateFound') +
        ' ' +
        remoteVersion +
        buildGapInfo() +
        i18n.t('updateWillRefresh'),
    );
    createToast({
      text: i18n.t('updateFound') + ' ' + remoteVersion,
      variant: 'success',
      icon: '🚀',
      id: 'update-found',
      duration: 3000,
    });
    setTimeout(applyUpdate, 1500);
  };

  // 页签隐藏时等下一轮检查，避免后台刷新
  if (document.hidden) {
    scheduleNext();
    return;
  }

  if (splashActive()) {
    const waitSplash = (): void => {
      if (!splashActive()) {
        runRefresh();
      } else {
        setTimeout(waitSplash, 380);
      }
    };
    waitSplash();
    return;
  }

  setTimeout(runRefresh, NOTIFY_DELAY);
}

async function checkForUpdate(): Promise<void> {
  if (!ENABLED) return;
  if (state.inFlight) return;
  state.inFlight = true;

  const remote = await fetchRemoteVersion();

  state.inFlight = false;

  if (!remote) {
    scheduleNext();
    return;
  }

  if (remote !== state.storedVersion) {
    queueGap(remote);
    proceed(remote);
  } else {
    scheduleNext();
  }
}

function handlePostRefresh(): void {
  if (!state.storedVersion || !state.storedVersion.startsWith('pending-'))
    return;

  writeStorage(STORAGE_KEYS.version, VERSION);
  state.storedVersion = VERSION;
  const now = Date.now();
  state.lastUpdate = now;
  writeStorage(STORAGE_KEYS.lastUpdate, now.toString());

  let message = i18n.t('updateComplete') + ' ' + VERSION;
  if (state.gapList.length > 1) {
    message +=
      ' ' +
      i18n.t('updateCumulative') +
      ' ' +
      state.gapList.length +
      ' ' +
      i18n.t('updateVersions');
  }
  announcer.push(message);
  createToast({
    text: message,
    variant: 'success',
    icon: '✅',
    id: 'update-done',
    duration: 5000,
  });

  state.gapList = [];
  persistGapList();
}

handlePostRefresh();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => checkForUpdate(), {
    once: true,
  });
} else {
  checkForUpdate();
}
