import { createToast } from './core';
import { i18n } from './i18n';

const last: Record<string, number> = { f12: 0, ctx: 0 };
const COOL: number = 3000;

function showToast(type: string): void {
  const now = Date.now();
  if (now - last[type] < COOL) return;
  last[type] = now;

  if (createToast) {
    const t = i18n?.t || ((k: string) => k);
    const message: string =
      type === 'f12' ? t('devToolsDisabled') : t('contextMenuDisabled');
    createToast({
      text: message,
      id: 'protect-' + type,
      variant: 'neutral',
      duration: 2500,
    });
  }
}

// Disable F12
['keydown', 'keyup', 'keypress'].forEach((t) =>
  document.addEventListener(t, (e: KeyboardEvent) => {
    if (e.key === 'F12') {
      e.preventDefault();
      showToast('f12');
    }
  }),
);

// Allow selection on editable elements
const isSelectAllowed = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement &&
  (((el as HTMLInputElement).tagName === 'INPUT' && (el as HTMLInputElement).type === 'text') ||
    (el as HTMLElement).tagName === 'TEXTAREA' ||
    (el as HTMLElement).isContentEditable);

// Disable context menu
document.addEventListener('contextmenu', (e: MouseEvent) => {
  if (!isSelectAllowed(e.target)) {
    e.preventDefault();
    showToast('ctx');
  }
});

// Disable text selection
document.addEventListener('selectstart', (e: Event) => {
  if (!isSelectAllowed(e.target)) {
    e.preventDefault();
    showToast('sel');
  }
});
