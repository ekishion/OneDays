import { APP_CONFIG } from './config';
import { readStorage, writeStorage } from './runtime-guards';

interface AnnouncementMessage {
  text: string;
  icon?: string;
  priority?: string;
  expiresAt?: string;
  [key: string]: unknown;
}

interface AnnouncementState {
  items: AnnouncementMessage[];
  index: number;
  panes: HTMLSpanElement[];
  mode: 'single' | 'carousel';
  rotateTimer: number | null;
  remoteTimer: number | null;
  stack: HTMLDivElement | null;
  seenKeys: Set<string>;
}

const cfg = APP_CONFIG || {};

// Internal registerMessages — will be assigned during init if the box exists
let _registerMessages: ((messages: unknown, opts?: { priority?: string }) => void) | null = null;

export function announceAdd(msg: unknown, opts?: { priority?: string }): void {
  const box = document.getElementById('announcement');
  if (!box || !box.parentNode || box.classList.contains('ann-hide')) {
    console.warn('[Announcement] 公告已关闭，无法添加新消息');
    return;
  }
  if (_registerMessages) _registerMessages(msg, opts);
}

const box = document.getElementById('announcement');
if (box) {
  if (cfg.enableAnnouncement === false) {
    box.remove();
    delete (window as any).__ANN_PENDING;
    delete (window as any).__announceAdd;
    console.log('[Announcement] 公告系统已禁用，清理完成');
  } else {
    const host = box.querySelector('.ann-text') as HTMLElement | null;
    const iconEl = box.querySelector('.ann-icon') as HTMLElement | null;
    const closeBtn = box.querySelector('.ann-close') as HTMLElement | null;

    if (!host) {
      console.warn('[Announcement] 找不到文本容器 .ann-text');
    } else {
      const storeKey: string = cfg.announcementDismissKey || 'ann-card-v1';
      if (readStorage(storeKey)) {
        box.remove();
      } else {
        if (iconEl) iconEl.textContent = cfg.announcementIcon || '\u{1F4E2}';

        const cycle: number = Math.max(2000, cfg.announcementCycleInterval || 4800);
        const transition: number = Math.min(cycle - 600, cfg.announcementTransition || 500);

        const state: AnnouncementState = {
          items: [],
          index: 0,
          panes: [],
          mode: 'single',
          rotateTimer: null,
          remoteTimer: null,
          stack: null,
          seenKeys: new Set(),
        };

        function makeKey(msg: AnnouncementMessage | string | null): string | null {
          if (msg == null) return null;
          if (typeof msg === 'string') return msg;
          if (typeof msg.text === 'string') return msg.text;
          return JSON.stringify(msg);
        }

        function isExpired(msg: AnnouncementMessage | null): boolean {
          if (!msg || typeof msg !== 'object' || !msg.expiresAt) return false;
          try {
            return new Date(msg.expiresAt).getTime() < Date.now();
          } catch (_) {
            return false;
          }
        }

        function normalizeMessage(msg: unknown): AnnouncementMessage | null {
          if (!msg) return null;
          if (typeof msg === 'string') return { text: msg };
          if (typeof msg === 'object' && typeof (msg as AnnouncementMessage).text === 'string')
            return { ...(msg as AnnouncementMessage) };
          return null;
        }

        function registerMessages(messages: unknown, opts: { priority?: string } = {}): void {
          const normalized: AnnouncementMessage[] = [];
          const list = Array.isArray(messages) ? messages : [messages];

          for (const msg of list) {
            const normalizedMsg = normalizeMessage(msg);
            if (!normalizedMsg) continue;
            if (isExpired(normalizedMsg)) continue;
            const key = makeKey(normalizedMsg);
            if (key && state.seenKeys.has(key)) continue;
            if (key) state.seenKeys.add(key);
            normalized.push(normalizedMsg);
          }

          if (!normalized.length) return;

          if (opts.priority === 'front') {
            state.items = normalized.concat(state.items);
            state.index = 0;
          } else {
            state.items = state.items.concat(normalized);
          }

          ensureRendering();
        }

        // Expose registerMessages for the exported announceAdd
        _registerMessages = registerMessages;

        function getText(msg: AnnouncementMessage): string {
          return msg && typeof msg.text === 'string' ? msg.text : '';
        }

        function stopRotation(): void {
          if (state.rotateTimer) {
            clearTimeout(state.rotateTimer);
            state.rotateTimer = null;
          }
        }

        function stopRemote(): void {
          if (state.remoteTimer) {
            clearTimeout(state.remoteTimer);
            state.remoteTimer = null;
          }
        }

        function applyMessageStyle(msg: AnnouncementMessage | null): void {
          box.classList.remove('ann-info', 'ann-warn', 'ann-success', 'ann-error');
          if (msg && msg.priority) {
            box.classList.add('ann-' + msg.priority);
          }
          if (iconEl) {
            iconEl.textContent = (msg && msg.icon) || cfg.announcementIcon || '\u{1F4E2}';
          }
        }

        function showSingleMessage(msg: AnnouncementMessage): void {
          stopRotation();
          state.mode = 'single';
          state.panes = [];
          if (state.stack) {
            state.stack.remove();
            state.stack = null;
          }
          host.textContent = getText(msg);
          applyMessageStyle(msg);
        }

        function ensureCarouselStructure(): void {
          if (state.mode === 'carousel' && state.stack && state.panes.length === 2)
            return;

          stopRotation();
          host.innerHTML = '';

          const stack = document.createElement('div');
          stack.className = 'ann-stack';
          const paneA = document.createElement('span');
          paneA.className = 'ann-pane active';
          const paneB = document.createElement('span');
          paneB.className = 'ann-pane';
          stack.appendChild(paneA);
          stack.appendChild(paneB);
          host.appendChild(stack);

          state.stack = stack;
          state.panes = [paneA, paneB];
          state.mode = 'carousel';

          requestAnimationFrame(() => {
            stack.style.height = paneA.offsetHeight + 'px';
          });
        }

        function renderCurrent(): void {
          if (state.items.length === 0) {
            box.remove();
            stopRotation();
            stopRemote();
            delete (window as any).__announceAdd;
            return;
          }

          if (state.items.length === 1) {
            showSingleMessage(state.items[0]);
            return;
          }

          ensureCarouselStructure();

          const [currentPane, nextPane] = state.panes;
          const currentMsg = state.items[state.index % state.items.length];
          currentPane.textContent = getText(currentMsg);
          currentPane.classList.add('active');
          nextPane.classList.remove('active');
          applyMessageStyle(currentMsg);
          state.index = (state.index + 1) % state.items.length;

          requestAnimationFrame(() => {
            state.stack!.style.height = currentPane.offsetHeight + 'px';
          });

          scheduleNextFlip();
        }

        function scheduleNextFlip(): void {
          stopRotation();
          state.rotateTimer = window.setTimeout(flipPane, cycle);
        }

        function flipPane(): void {
          if (state.mode !== 'carousel' || state.panes.length !== 2) return;
          if (state.items.length <= 1) {
            ensureRendering();
            return;
          }

          const [currentPane, nextPane] = state.panes;
          const nextMsg = state.items[state.index % state.items.length];
          state.index = (state.index + 1) % state.items.length;

          nextPane.textContent = getText(nextMsg);
          applyMessageStyle(nextMsg);

          requestAnimationFrame(() => {
            const newHeight = nextPane.offsetHeight;
            state.stack!.style.height = newHeight + 'px';

            currentPane.classList.remove('active');
            nextPane.classList.add('active');

            const duration = transition + 'ms';
            currentPane.style.setProperty('--ann-trans', duration);
            nextPane.style.setProperty('--ann-trans', duration);
          });

          state.panes.reverse();
          scheduleNextFlip();
        }

        function ensureRendering(): void {
          if (!box || !box.parentNode) return;
          if (state.index >= state.items.length) {
            state.index = 0;
          }
          renderCurrent();
        }

        function fetchRemoteMessages(): void {
          if (!cfg.enableAnnouncementRemoteFeed) return;
          const source: string | undefined = cfg.announcementRemoteSource;
          if (!source) return;

          const refresh: number = Math.max(60000, cfg.announcementRemoteRefresh || 3600000);

          const doFetch = (): void => {
            fetch(source, { cache: 'no-store' })
              .then((res) =>
                res.ok ? res.json() : Promise.reject(new Error(res.statusText)),
              )
              .then((data) => {
                if (Array.isArray(data)) {
                  registerMessages(data);
                } else if (data && Array.isArray(data.messages)) {
                  registerMessages(data.messages);
                }
              })
              .catch((err) => {
                console.warn('[Announcement] 远程公告获取失败:', err);
              })
              .finally(() => {
                state.remoteTimer = window.setTimeout(doFetch, refresh);
              });
          };

          doFetch();
        }

        function handleClose(): void {
          stopRotation();
          stopRemote();
          delete (window as any).__announceAdd;
          box.classList.add('ann-hide');
          setTimeout(() => {
            if (box.parentNode) {
              box.remove();
            }
          }, 400);
        }

        if (cfg.enableAnnouncementClose && closeBtn) {
          closeBtn.hidden = false;
          closeBtn.addEventListener('click', () => {
            try {
              writeStorage(storeKey, '1');
            } catch (_) {
              /* ignore */
            }
            handleClose();
          });
        }

        box.classList.add('announcement-card');
        box.hidden = false;

        registerMessages(
          Array.isArray((window as any).__ANN_PENDING)
            ? (window as any).__ANN_PENDING.splice(0)
            : [],
          {
            priority: 'front',
          },
        );
        registerMessages((cfg.announcementMessages || []).filter(Boolean));

        if (!state.items.length) {
          box.remove();
        } else {
          ensureRendering();
          (window as any).__announceAdd = announceAdd;
          fetchRemoteMessages();
        }
      }
    }
  }
}
