import { APP_CONFIG } from './config';
import { createToast } from './core';

const reducedMotion: boolean = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ===== Scroll progress bar =====
function buildScrollProgress(): void {
  if (!APP_CONFIG.enableScrollProgress || document.querySelector('.scroll-progress'))
    return;
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.appendChild(bar);
  let ticking = false;
  const calc = (): void => {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max ? (h.scrollTop / max) * 100 : 0) + '%';
    ticking = false;
  };
  const onScroll = (): void => {
    if (document.hidden) return;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(calc);
    }
  };
  ['scroll', 'resize'].forEach((ev: string) =>
    window.addEventListener(ev, onScroll, { passive: true }),
  );
  const vis = (): void => {
    if (!document.hidden) calc();
  };
  document.addEventListener('visibilitychange', vis);
  calc();
}

// ===== Cat click confetti =====
function bindConfetti(): void {
  if (!APP_CONFIG.enableConfetti || reducedMotion) return;
  const cat = document.getElementById('maomao');
  if (!cat || (cat as HTMLElement).dataset.confettiBound) return;
  (cat as HTMLElement).dataset.confettiBound = '1';
  function spawnConfetti(n: number): void {
    const rect = cat!.getBoundingClientRect();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i');
      const size = 6 + Math.random() * 6;
      const hue = Math.floor(Math.random() * 360);
      Object.assign(el.style, {
        position: 'fixed',
        left: rect.left + rect.width / 2 + 'px',
        top: rect.top + rect.height / 2 + 'px',
        width: size + 'px',
        height: size * 0.45 + 'px',
        background: `hsl(${hue} 80% 60%)`,
        transform: `rotate(${Math.random() * 180}deg)`,
        borderRadius: '2px',
        pointerEvents: 'none',
        zIndex: 9999,
        opacity: '0',
        transition: 'transform 1.2s ease,opacity 1.2s ease',
      });
      frag.appendChild(el);
      requestAnimationFrame(() => {
        const dx = (Math.random() - 0.5) * 260;
        const dy = 200 + Math.random() * 180;
        el.style.opacity = '1';
        el.style.transform += ` translate(${dx}px,${dy}px)`;
        el.style.filter = 'blur(.3px)';
        setTimeout(() => (el.style.opacity = '0'), 900);
        setTimeout(() => el.remove(), 1400);
      });
    }
    document.body.appendChild(frag);
  }
  const handler = (): void => spawnConfetti(36);
  cat!.addEventListener('click', handler);
}

// ===== Console welcome + ASCII =====
try {
  const bannerStyle: string =
    'color:#fff;background:linear-gradient(90deg,var(--accent,#f36),#333);padding:4px 10px;border-radius:4px 0 0 4px;font-weight:600';
  const textStyle: string =
    'color:#fff;background:#333;padding:4px 10px;border-radius:0 4px 4px 0;font-weight:500';
  console.log(
    '%c Welcome %c ' + new Date().getFullYear() + ' ',
    ' ' + bannerStyle,
    ' ' + textStyle,
  );
  if (APP_CONFIG.enableAsciiPanel) {
    console.log(
      '\n %c喵%c  想找什么? 试试输入 %cshowAscii()%c ~\n',
      'color:#f36;font-weight:700',
      'color:#888',
      'color:#4aa;border-bottom:1px dotted #4aa',
      '',
    );
    (window as any).showAscii = (): void => {
      if (document.getElementById('ascii-layer')) return;
      const ascii: string =
        '  /\\_/\\   喵~\n ( o.o )  Stay curious.\n  > ^ <   Have a nice day!';
      const box = document.createElement('div');
      box.id = 'ascii-layer';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', 'ASCII 彩蛋');
      Object.assign(box.style, {
        position: 'fixed',
        bottom: '18px',
        right: '20px',
        maxWidth: '280px',
        background:
          'linear-gradient(145deg,rgba(20,20,22,.85),rgba(30,32,36,.82))',
        color: '#eee',
        padding: '12px 14px 10px',
        fontFamily:
          'ui-monospace, "SFMono-Regular", "Menlo", "Consolas", monospace',
        fontSize: '12px',
        lineHeight: '1.45',
        borderRadius: '14px',
        zIndex: 10000,
        backdropFilter: 'blur(10px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(10px) saturate(1.2)',
        boxShadow:
          '0 4px 24px -6px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.07)',
        overflow: 'hidden',
        animation: 'ascii-pop .35s cubic-bezier(.4,0,.2,1)',
        cursor: 'default',
      });
      // Gradient border
      box.style.border = '1px solid transparent';
      box.style.backgroundImage =
        'linear-gradient(145deg,rgba(20,20,22,.88),rgba(30,32,36,.88)),linear-gradient(120deg,var(--accent,#f36),transparent 60%)';
      box.style.backgroundOrigin = 'border-box';
      box.style.backgroundClip = 'padding-box,border-box';

      const bar = document.createElement('div');
      bar.style.display = 'flex';
      bar.style.alignItems = 'center';
      bar.style.marginBottom = '6px';
      bar.style.gap = '6px';
      const title = document.createElement('span');
      title.textContent = 'ASCII';
      title.style.font = '600 11px system-ui,sans-serif';
      title.style.letterSpacing = '.12em';
      title.style.color = 'var(--accent,#f36)';
      title.style.textShadow =
        '0 0 6px color-mix(in srgb,var(--accent,#f36),transparent 65%)';
      title.style.flex = '1';
      const btnGroup = document.createElement('div');
      btnGroup.style.display = 'flex';
      btnGroup.style.gap = '4px';
      function smallBtn(txt: string, label?: string): HTMLButtonElement {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = txt;
        Object.assign(b.style, {
          background: 'rgba(255,255,255,.06)',
          color: '#ddd',
          border: '1px solid rgba(255,255,255,.12)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: '500',
          fontSize: '10px',
          padding: '2px 7px 3px',
          borderRadius: '6px',
          cursor: 'pointer',
          letterSpacing: '.05em',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'background .25s,border-color .25s,transform .25s',
        });
        b.setAttribute('aria-label', label || txt);
        b.onmouseenter = () => {
          b.style.background = 'var(--accent,#f36)';
          b.style.color = '#fff';
          b.style.borderColor = 'var(--accent,#f36)';
        };
        b.onmouseleave = () => {
          b.style.background = 'rgba(255,255,255,.06)';
          b.style.color = '#ddd';
          b.style.border = '1px solid rgba(255,255,255,.12)';
        };
        b.onmousedown = () => (b.style.transform = 'scale(.92)');
        b.onmouseup = () => (b.style.transform = '');
        return b;
      }
      const copyBtn = smallBtn('COPY', '复制');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard &&
          navigator.clipboard.writeText(ascii).then(() => toast('已复制'));
      });
      const closeBtn = smallBtn('CLOSE', '关闭');
      function closeAscii(): void {
        box.remove();
        document.removeEventListener('keydown', esc);
      }
      closeBtn.addEventListener('click', closeAscii);
      btnGroup.append(copyBtn, closeBtn);
      bar.append(title, btnGroup);
      box.appendChild(bar);
      const pre = document.createElement('pre');
      pre.textContent = ascii;
      Object.assign(pre.style, {
        margin: '0',
        whiteSpace: 'pre',
        background: 'none',
        padding: '0',
      });
      box.appendChild(pre);

      // Drag
      let drag = false,
        sx = 0,
        sy = 0,
        origX = 0,
        origY = 0;
      bar.style.cursor = 'move';
      const start = (e: MouseEvent | TouchEvent): void => {
        drag = true;
        const p = (e as TouchEvent).touches
          ? (e as TouchEvent).touches[0]
          : (e as MouseEvent);
        sx = p.clientX;
        sy = p.clientY;
        const r = box.getBoundingClientRect();
        origX = r.right;
        origY = r.bottom;
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', end);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', end);
      };
      const move = (e: MouseEvent | TouchEvent): void => {
        if (!drag) return;
        const p = (e as TouchEvent).touches
          ? (e as TouchEvent).touches[0]
          : (e as MouseEvent);
        e.preventDefault && e.preventDefault();
        const dx = p.clientX - sx;
        const dy = p.clientY - sy;
        const x = origX - dx;
        const y = origY - dy;
        box.style.right = Math.max(4, window.innerWidth - x) + 'px';
        box.style.bottom = Math.max(4, window.innerHeight - y) + 'px';
      };
      const end = (): void => {
        drag = false;
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', end);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', end);
      };
      bar.addEventListener('mousedown', start);
      bar.addEventListener('touchstart', start, { passive: true });

      // Toast helper
      function toast(msg: string): void {
        createToast({
          text: msg,
          variant: 'accent',
          duration: 1800,
        });
      }

      // Keyboard Esc close
      const esc = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
          closeAscii();
        }
      };
      document.addEventListener('keydown', esc);

      // Entry animation keyframe (if not defined)
      if (!document.getElementById('ascii-pop-style')) {
        const st = document.createElement('style');
        st.id = 'ascii-pop-style';
        st.textContent =
          '@keyframes ascii-pop{from{opacity:0;transform:translateY(8px) scale(.96);}to{opacity:1;transform:none;}}';
        document.head.appendChild(st);
      }

      document.body.appendChild(box);
    };
  }
} catch (_) {}

// Scroll progress bar
buildScrollProgress();

// Cat click confetti
bindConfetti();
