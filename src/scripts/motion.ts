/* ============================================================
   FAHRSCHULE ANTONIO MARINO — MOTION KIT (single source)
   GSAP 3.15 + ScrollTrigger. Imported once in BaseLayout.
   ------------------------------------------------------------
   Contract for page agents:
     .reveal                      → fade-up reveal on scroll
     [data-anim="fade-up"]        → translateY(40) + fade
     [data-anim="fade-in"]        → fade only
     [data-anim="scale-in"]       → scale(0.94) + fade
     [data-anim="slide-left"]     → from right (x:48) → 0
     [data-anim="slide-right"]    → from left  (x:-48) → 0
     [data-anim-delay="0.2"]      → per-element stagger delay (s)
     .hero  (wrapper)             → entrance timeline on load for
                                    its [data-hero] children (or direct kids)
     .btn-magnetic                → cursor-follow magnetic effect
     [data-count="63"]            → count-up when scrolled into view
        [data-count-suffix="+"]   → optional suffix (also infers + / % / etc.)
        [data-count-decimals="1"] → optional decimals (e.g. 4.9)
     #site-header                 → data-scrolled="true|false" past 40px
     [data-parallax]              → subtle translateY on scroll
        [data-parallax-speed="0.2"] optional strength (default 0.18)

   FOUC: html.js hides .reveal / [data-anim] via global.css. We always
   set the final visible state (even on reduced motion) so nothing stays
   hidden. Every selector is guarded — missing elements never throw.
   ============================================================ */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ----- per-data-anim from/to maps ----- */
type Vars = gsap.TweenVars;
const ANIM_FROM: Record<string, Vars> = {
  'fade-up': { opacity: 0, y: 40 },
  'fade-in': { opacity: 0 },
  'scale-in': { opacity: 0, scale: 0.94 },
  'slide-left': { opacity: 0, x: 48 },
  'slide-right': { opacity: 0, x: -48 },
};

/* Reveal one element (or kill its hidden state on reduced motion). */
function revealElement(el: HTMLElement): void {
  const animName = el.getAttribute('data-anim');
  const delay = parseFloat(el.getAttribute('data-anim-delay') || '0') || 0;
  const from = (animName && ANIM_FROM[animName]) || ANIM_FROM['fade-up'];

  if (prefersReducedMotion()) {
    gsap.set(el, { opacity: 1, x: 0, y: 0, scale: 1, clearProps: 'transform' });
    return;
  }

  gsap.fromTo(
    el,
    from,
    {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.85,
      delay,
      ease: 'power3.out',
      clearProps: 'transform',
    }
  );
}

/* ---------- (a) SCROLL REVEALS ---------- */
function initScrollReveals(): void {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>('.reveal, [data-anim]')
  ).filter((el) => !el.closest('.hero')); // hero handled by its own timeline

  if (!nodes.length) return;

  if (prefersReducedMotion()) {
    nodes.forEach((el) =>
      gsap.set(el, { opacity: 1, x: 0, y: 0, scale: 1, clearProps: 'transform' })
    );
    return;
  }

  // Batch for performance; start when ~85% down the viewport.
  ScrollTrigger.batch(nodes, {
    start: 'top 85%',
    once: true,
    onEnter: (batch) =>
      (batch as HTMLElement[]).forEach((el, i) => {
        // honour explicit delay, else gentle index stagger within a batch
        if (!el.hasAttribute('data-anim-delay')) {
          el.setAttribute('data-anim-delay', String(Math.min(i * 0.06, 0.3)));
        }
        revealElement(el);
      }),
  });
}

/* ---------- (b) HERO ENTRANCE TIMELINE ---------- */
function initHero(): void {
  const hero = document.querySelector<HTMLElement>('.hero');
  if (!hero) return;

  // Prefer explicit [data-hero] children; fall back to direct children.
  let targets = Array.from(hero.querySelectorAll<HTMLElement>('[data-hero]'));
  if (!targets.length) {
    targets = Array.from(hero.children).filter(
      (n): n is HTMLElement => n instanceof HTMLElement
    );
  }
  if (!targets.length) return;

  // Make sure hero targets are revealable even if not tagged .reveal/[data-anim]
  if (prefersReducedMotion()) {
    gsap.set(targets, { opacity: 1, x: 0, y: 0, scale: 1, clearProps: 'transform' });
    return;
  }

  gsap.set(targets, { opacity: 0, y: 36 });
  gsap.to(targets, {
    opacity: 1,
    y: 0,
    duration: 0.9,
    ease: 'power3.out',
    stagger: 0.12,
    delay: 0.1,
    clearProps: 'transform',
  });
}

/* ---------- (c) MAGNETIC BUTTONS ---------- */
function initMagnetic(): void {
  if (prefersReducedMotion()) return;
  const buttons = document.querySelectorAll<HTMLElement>('.btn-magnetic');
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    const strength = 0.32;
    const onMove = (e: MouseEvent): void => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(btn, {
        x: x * strength,
        y: y * strength,
        duration: 0.4,
        ease: 'power3.out',
      });
    };
    const onLeave = (): void => {
      gsap.to(btn, {
        x: 0,
        y: 0,
        duration: 0.6,
        ease: 'elastic.out(1, 0.4)',
      });
    };
    btn.addEventListener('mousemove', onMove);
    btn.addEventListener('mouseleave', onLeave);
  });
}

/* ---------- (d) ANIMATED COUNTERS ---------- */
function initCounters(): void {
  const counters = document.querySelectorAll<HTMLElement>('[data-count]');
  if (!counters.length) return;

  counters.forEach((el) => {
    const target = parseFloat(el.getAttribute('data-count') || '0') || 0;
    const decimals = parseInt(el.getAttribute('data-count-decimals') || '0', 10) || 0;
    const rawText = (el.textContent || '').trim();
    // Suffix: explicit attr wins; else infer trailing non-numeric chars (+, %, /5 …)
    let suffix = el.getAttribute('data-count-suffix');
    let prefix = el.getAttribute('data-count-prefix') || '';
    if (suffix === null) {
      const m = rawText.match(/[^\d.,\s]+$/);
      suffix = m ? m[0] : '';
    }

    const format = (val: number): string => {
      const n = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toString();
      return `${prefix}${n}${suffix}`;
    };

    const run = (): void => {
      if (prefersReducedMotion()) {
        el.textContent = format(target);
        return;
      }
      const state = { v: 0 };
      gsap.to(state, {
        v: target,
        duration: 1.4,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = format(state.v);
        },
        onComplete: () => {
          el.textContent = format(target);
        },
      });
    };

    if (prefersReducedMotion()) {
      el.textContent = format(target);
      return;
    }

    // Reset to 0 then count up when scrolled into view (once).
    el.textContent = format(0);
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: run,
    });
  });
}

/* ---------- (e) HEADER SHRINK / ELEVATE ---------- */
function initHeaderScroll(): void {
  const header = document.getElementById('site-header');
  if (!header) return;
  const update = (): void => {
    header.setAttribute('data-scrolled', window.scrollY > 40 ? 'true' : 'false');
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
}

/* ---------- (f) PARALLAX ---------- */
function initParallax(): void {
  if (prefersReducedMotion()) return;
  const nodes = document.querySelectorAll<HTMLElement>('[data-parallax]');
  if (!nodes.length) return;

  nodes.forEach((el) => {
    const speed = parseFloat(el.getAttribute('data-parallax-speed') || '0.18') || 0.18;
    gsap.to(el, {
      yPercent: -speed * 100,
      ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });
  });
}

/* ============================================================
   ANIMATED FAVICON — on-brand canvas: dark rounded square +
   gold windshield/road motif with moving road-dash marks.
   ~11 fps, pauses when document.hidden, updates link[rel=icon].
   ============================================================ */
export function initAnimatedFavicon(): void {
  if (typeof document === 'undefined') return;

  const SIZE = 64;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Find or create the icon link element.
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }

  // Marino palette
  const BG = '#0B0F0E';
  const GOLD = '#FFAE35';
  const GOLD_BRIGHT = '#FFC15E';
  const TEAL = '#007063';

  const rr = (x: number, y: number, w: number, h: number, r: number): void => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  let dash = 0; // road-dash phase (px), advances each frame
  let raf = 0;
  let last = 0;
  const FPS = 11;
  const FRAME_MS = 1000 / FPS;

  const draw = (): void => {
    // Background rounded square
    ctx.clearRect(0, 0, SIZE, SIZE);
    rr(2, 2, SIZE - 4, SIZE - 4, 14);
    ctx.fillStyle = BG;
    ctx.fill();
    // subtle teal-tinted top glow (depth)
    const glow = ctx.createLinearGradient(0, 0, 0, SIZE);
    glow.addColorStop(0, 'rgba(0,112,99,0.30)');
    glow.addColorStop(1, 'rgba(0,112,99,0)');
    rr(2, 2, SIZE - 4, SIZE - 4, 14);
    ctx.fillStyle = glow;
    ctx.fill();

    // Windshield trapezoid (echoes the logo's road-through-windshield)
    ctx.save();
    rr(2, 2, SIZE - 4, SIZE - 4, 14);
    ctx.clip();

    ctx.beginPath();
    ctx.moveTo(16, 16); // top-left
    ctx.lineTo(48, 16); // top-right
    ctx.lineTo(56, 52); // bottom-right (wider)
    ctx.lineTo(8, 52); // bottom-left (wider)
    ctx.closePath();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Road inside the windshield: converging side lines + moving centre dashes
    ctx.strokeStyle = 'rgba(255,174,53,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(28, 18);
    ctx.lineTo(20, 50);
    ctx.moveTo(36, 18);
    ctx.lineTo(44, 50);
    ctx.stroke();

    // Moving centre dashes (the "BALLERN" motion)
    ctx.strokeStyle = GOLD_BRIGHT;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.setLineDash([6, 7]);
    ctx.lineDashOffset = dash; // +dash → dashes rush DOWNWARD toward the viewer (driving forward)
    ctx.beginPath();
    ctx.moveTo(32, 50);
    ctx.lineTo(32, 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Horizon accent dot (teal) at vanishing point
    ctx.beginPath();
    ctx.arc(32, 17, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = TEAL;
    ctx.fill();

    try {
      if (link) link.href = canvas.toDataURL('image/png');
    } catch {
      /* tainted canvas / unsupported — silently stop */
    }
  };

  const loop = (t: number): void => {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return; // PAUSE when tab not visible
    if (t - last < FRAME_MS) return;
    last = t;
    dash = (dash + 3) % 26; // advance dash phase → road appears to move
    draw();
  };

  // Draw a static first frame immediately (graceful even before rAF kicks in)
  draw();

  if (prefersReducedMotion()) return; // static favicon only

  // Pause/resume cleanly on visibility change.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  });

  raf = requestAnimationFrame(loop);
}

/* ---------- BOOTSTRAP ---------- */
function init(): void {
  // Header + favicon run regardless of motion preference.
  initHeaderScroll();
  initAnimatedFavicon();

  if (prefersReducedMotion()) {
    // Show everything in its final, untransformed state. No animations.
    initScrollReveals(); // sets opacity:1 path internally
    initHero();
    initCounters();
    return;
  }

  initScrollReveals();
  initHero();
  initMagnetic();
  initCounters();
  initParallax();

  // Recalculate triggers once images/fonts settle.
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
