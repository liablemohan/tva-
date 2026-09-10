// HeroAnimationController — per-tile configs generated from tile data, then
// driven either by scroll progress (default, staircase assembly) or by a
// GSAP timeline. Only transform + opacity are animated.

function rand(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
// gentler in-out for the lead tile's drop
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function buildConfig(el, i, total, gridRect, navBottom) {
  const r1 = rand(i + 1), r2 = rand(i + 7.3), r3 = rand(i + 21.9), r4 = rand(i + 44.1);
  const box = el.getBoundingClientRect();
  const cx = (box.left + box.width / 2 - gridRect.left) / Math.max(gridRect.width, 1);
  const dir = cx > 0.5 ? 1 : -1;

  const phase = i < 3 ? 0 : i < 8 ? 1 : 2;

  // the lead tile (top-right) starts just below the nav, small and transparent,
  // then drops smoothly, fading up and growing to full size
  if (i === 0) {
    return {
      el, order: i, phase: 0,
      from: { x: 0, y: navBottom + 16 - box.top, scale: 0.55, opacity: 0, rotate: 0 },
      start: 0, span: 0.5, smooth: true,
      at: 0.35, stagger: 0, duration: 1.25,
    };
  }

  const startsVisible = r3 > 0.72;
  const bigEntry = r1 > 0.6;

  return {
    el,
    order: i,
    phase,
    from: {
      // keep entrances inside the frame — the hero is one viewport tall now
      x: dir * (70 + r1 * 190) * (phase === 2 ? 0.6 : 1),
      y: (r2 - 0.3) * (phase === 0 ? 150 : 110),
      scale: bigEntry ? 1.15 + r4 * 0.35 : 0.68 + r2 * 0.2,
      opacity: startsVisible ? 1 : 0,
      rotate: r3 > 0.86 ? dir * 2 : 0,
    },
    start: 0.06 + (i / total) * 0.46 + (r4 - 0.5) * 0.03,
    span: 0.44 + r2 * 0.12,
    smooth: true,
    at: [0.9, 1.35, 1.8][phase],
    stagger: [0.12, 0.08, 0.045][phase],
    duration: 0.95 + r2 * 0.35,
  };
}

function parseColor(str) {
  const m = String(str).match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(",").map(Number);
    return { r: p[0], g: p[1], b: p[2] };
  }
  const h = String(str).replace("#", "");
  if (h.length === 6) {
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  return { r: 15, g: 52, b: 115 };
}

// WCAG relative luminance, with optional greyscale + brightness factor
function relLuminance(color, k = 1, grey = false) {
  let { r, g, b } = parseColor(color);
  if (grey) {
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = g = b = y;
  }
  const f = (v) => {
    const s = Math.min(255, v * k) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export class HeroAnimationController {
  constructor({ root, gsap, speed = 1, mode = "scroll", onDone } = {}) {
    this.root = root;
    this.gsap = gsap;
    this.speed = speed;
    this.mode = mode;
    this.onDone = onDone;
    this.tiles = [];
    this.timeline = null;
    this.raf = null;
    this.progress = -1;
  }

  initialize() {
    const { root, gsap } = this;
    if (!root || !gsap) return this;
    this.stage = root.querySelector("[data-hero-stage]");
    this.grid = root.querySelector("[data-hero-grid]");
    this.nav = root.querySelector("[data-hero-nav]");
    this.intro = Array.from(root.querySelectorAll("[data-hero-intro] > *"));
    if (!this.grid) return this;

    const els = Array.from(this.grid.children);
    const gridRect = this.grid.getBoundingClientRect();
    const navBottom = this.nav ? this.nav.getBoundingClientRect().bottom : 0;
    this.tiles = els.map((el, i) => buildConfig(el, i, els.length, gridRect, navBottom));

    this.tiles.forEach(({ el, from }) => {
      gsap.set(el, {
        x: from.x, y: from.y, scale: from.scale, rotate: from.rotate,
        opacity: from.opacity, force3D: true,
        willChange: "transform,opacity", transformOrigin: "50% 50%",
      });
    });
    gsap.set(this.nav, { opacity: 0 });
    gsap.set(this.intro, { opacity: 0, y: 18 });
    this.initHover();
    if (this.stage) gsap.set(this.stage, { opacity: 1 });
    return this;
  }

  // ---- hover: grey the tile, reveal a scattered overlay + project title ---
  initHover() {
    this.overlay = this.root.querySelector("[data-hover-overlay]");
    this.overlayBlocks = Array.from(this.root.querySelectorAll("[data-overlay-block]"));
    this.overlayTitle = this.root.querySelector("[data-overlay-title]");
    this.overlayTitleAlt = this.root.querySelector("[data-overlay-title-alt]");
    this.overlayClip = this.root.querySelector("[data-overlay-clip]");
    if (!this.overlay) return this;
    if (this.overlayTitle) this.gsap.set([this.overlayTitle, this.overlayTitleAlt].filter(Boolean), { yPercent: 110 });
    if (this.hoverBound) return this;
    this.hoverBound = true;

    this.tiles.forEach((t, i) => {
      const slot = t.el.querySelector && t.el.querySelector("image-slot");
      const label = (slot && slot.getAttribute("placeholder")) || (t.el.textContent || "").trim() || "project";
      t.el.style.transition = "filter 420ms ease";
      t.el.addEventListener("mouseenter", () => this.openOverlay(label, i + 1, t.el));
      t.el.addEventListener("mouseleave", () => this.closeOverlay(t.el));
    });
    return this;
  }

  openOverlay(label, seed, tileEl) {
    const { gsap } = this;
    if (!this.overlay) return;
    tileEl.style.filter = "grayscale(1) brightness(0.5)";
    if (this.overlayTitle) this.overlayTitle.textContent = label;
    if (this.overlayTitleAlt) this.overlayTitleAlt.textContent = label;

    const tileRect = tileEl.getBoundingClientRect();
    this.scatterBlocks(seed, tileRect);
    const clone = this.cloneHovered(tileEl);
    this.tuneTitleColor(tileRect);

    if (this.hoverTl) this.hoverTl.kill();
    const tl = gsap.timeline();
    tl.to(this.overlay, { opacity: 1, duration: 0.32, ease: "power2.out" }, 0);
    tl.fromTo(this.overlayBlocks,
      { opacity: 0, scale: 0.92, y: 26 },
      { opacity: 1, scale: 1, y: 0, duration: 0.55, stagger: 0.05, ease: "power3.out" }, 0.04);
    if (clone) tl.fromTo(clone, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" }, 0);
    tl.fromTo([this.overlayTitle, this.overlayTitleAlt].filter(Boolean),
      { yPercent: 110 },
      { yPercent: 0, duration: 0.75, ease: "power4.out" }, 0.12);
    this.hoverTl = tl;
  }

  // px placement: overlay tiles match the base grid tile size, never overlap
  // each other, the headline, or the greyed clone of the hovered tile
  scatterBlocks(seed, tileRect) {
    const pad = { l: 40, r: 40, t: 100, b: 70 };
    const vw = window.innerWidth, vh = window.innerHeight;
    const size = tileRect.width;
    const mask = this.overlayTitle && this.overlayTitle.parentElement;
    const t = mask ? mask.getBoundingClientRect() : { left: 0, top: 0, right: 0, bottom: 0 };
    const M = 22; // gap kept around every block
    // tiles may sit under the headline (its colour adapts), but not on the clone
    const reserved = [
      { l: tileRect.left - M, t: tileRect.top - M, r: tileRect.right + M, b: tileRect.bottom + M },
    ];
    const placed = [];
    const overlaps = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

    this.overlayBlocks.forEach((b, j) => {
      let chosen = null;
      for (let k = 0; k < 200 && !chosen; k++) {
        const x = pad.l + rand(seed * 3.1 + j * 5.7 + k * 1.3) * Math.max(1, vw - pad.l - pad.r - size);
        const y = pad.t + rand(seed * 7.7 + j * 2.9 + k * 2.1) * Math.max(1, vh - pad.t - pad.b - size);
        const cand = { l: x, t: y, r: x + size, b: y + size };
        const clash = reserved.concat(placed.map((p) => ({
          l: p.l - M, t: p.t - M, r: p.r + M, b: p.b + M,
        }))).some((z) => overlaps(cand, z));
        if (!clash) chosen = cand;
      }
      if (!chosen) { b.style.display = "none"; return; }
      placed.push(chosen);
      b.style.display = "";
      b.style.width = size + "px";
      b.style.height = size + "px";
      b.style.left = chosen.l + "px";
      b.style.top = chosen.t + "px";
    });
  }

  // white headline over the dark backdrop, with a dark copy clipped to
  // exactly the light-background regions it crosses (per-region contrast)
  tuneTitleColor(tileRect) {
    if (!this.overlayClip) return;
    const LIGHT = 0.18;
    const rects = [];
    this.overlayBlocks.forEach((b) => {
      if (b.style.display === "none") return;
      if (relLuminance(getComputedStyle(b).backgroundColor) > LIGHT) rects.push(b.getBoundingClientRect());
    });
    const cloneNode = this.root.querySelector("[data-overlay-clone] > *");
    if (cloneNode && relLuminance(getComputedStyle(cloneNode).backgroundColor, 0.55, true) > LIGHT) rects.push(tileRect);

    const path = rects.map((r) =>
      "M " + r.left + " " + r.top + " H " + r.right + " V " + r.bottom + " H " + r.left + " Z"
    ).join(" ") || "M 0 0 Z";
    this.overlayClip.style.clipPath = "path('" + path + "')";
    if (this.overlayTitle) this.overlayTitle.style.color = "#ffffff";
  }

  // grey copy of the hovered tile, pinned to its real position
  cloneHovered(tileEl) {
    const host = this.root.querySelector("[data-overlay-clone]");
    if (!host) return null;
    host.innerHTML = "";
    const r = tileEl.getBoundingClientRect();
    const node = tileEl.cloneNode(true);
    node.style.position = "absolute";
    node.style.boxSizing = "border-box";
    node.style.transform = "none";
    node.style.margin = "0";
    node.style.left = r.left + "px";
    node.style.top = r.top + "px";
    node.style.width = r.width + "px";
    node.style.height = r.height + "px";
    node.style.opacity = "1";
    node.style.gridColumn = "auto";
    node.style.filter = "grayscale(1) brightness(0.55)";
    // avoid duplicate persistence keys for the cloned image slots
    node.querySelectorAll && node.querySelectorAll("image-slot").forEach((s) => s.removeAttribute("id"));
    host.appendChild(node);
    return node;
  }

  closeOverlay(tileEl) {
    const { gsap } = this;
    if (tileEl) tileEl.style.filter = "none";
    if (!this.overlay) return;
    if (this.hoverTl) this.hoverTl.kill();
    const tl = gsap.timeline();
    tl.to([this.overlayTitle, this.overlayTitleAlt].filter(Boolean), { yPercent: 110, duration: 0.35, ease: "power2.in" }, 0);
    tl.to(this.overlayBlocks, { opacity: 0, duration: 0.3, ease: "power1.in" }, 0);
    tl.to(this.overlay, { opacity: 0, duration: 0.3 }, 0.12);
    this.hoverTl = tl;
  }

  playIntro() {
    const { gsap } = this;
    if (!gsap) {
      // no engine: leave the copy plainly visible
      [].concat(this.intro || [], this.nav || []).forEach((n) => {
        if (n && n.style) { n.style.opacity = 1; n.style.transform = "none"; }
      });
      return this;
    }
    const tl = gsap.timeline();
    tl.timeScale(this.speed);
    tl.to(this.nav, { opacity: 1, duration: 0.7, ease: "power1.out" }, 0.15);
    tl.to(this.intro, { opacity: 1, y: 0, duration: 0.9, stagger: 0.14, ease: "power2.out" }, 0.35);
    this.introTl = tl;
    return this;
  }

  // ---- scroll-driven assembly -------------------------------------------
  enableScroll() {
    if (!this.grid) return this;
    const loop = () => {
      this.applyProgress(this.readProgress());
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    return this;
  }

  readProgress() {
    const rect = this.grid.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const travel = rect.height * 0.75 + vh * 0.9;
    const p = (vh - rect.top) / travel;
    return clamp01(p);
  }

  applyProgress(p) {
    if (Math.abs(p - this.progress) < 0.0005) return;
    this.progress = p;
    const set = this.gsap.set;
    this.tiles.forEach((t) => {
      const raw = clamp01((p - t.start) / t.span);
      const local = t.smooth ? smooth(raw) : easeOut(raw);
      // opacity leads the movement slightly so tiles fade in rather than pop
      const fade = smooth(clamp01(raw * 1.25));
      const inv = 1 - local;
      set(t.el, {
        x: t.from.x * inv,
        y: t.from.y * inv,
        scale: 1 + (t.from.scale - 1) * inv,
        rotate: t.from.rotate * inv,
        opacity: t.from.opacity === 1 ? 1 : fade,
        force3D: true,
      });
    });
  }

  // ---- timed assembly (mode: "timeline") --------------------------------
  playTileAssembly() {
    const { gsap } = this;
    if (!gsap || !this.tiles.length) return this;
    const tl = gsap.timeline({ onComplete: () => this.onDone && this.onDone() });
    tl.timeScale(this.speed);
    this.tiles.forEach((t) => {
      const idx = this.tiles.filter((o) => o.phase === t.phase && o.order < t.order).length;
      tl.to(t.el, {
        x: 0, y: 0, scale: 1, rotate: 0, opacity: 1,
        duration: t.duration, force3D: true,
        ease: "power2.inOut",
      }, t.at + idx * t.stagger);
    });
    this.timeline = tl;
    return this;
  }

  play() {
    this.playIntro();
    return this.mode === "scroll" ? this.enableScroll() : this.playTileAssembly();
  }

  setFinalState() {
    const { gsap } = this;
    this.stopScroll();
    if (this.timeline) this.timeline.kill();
    if (this.introTl) this.introTl.kill();
    if (!gsap) return this;
    gsap.set(this.tiles.map((t) => t.el), {
      x: 0, y: 0, scale: 1, rotate: 0, opacity: 1,
      clearProps: "willChange",
    });
    if (this.grid) gsap.set(this.grid, { scale: 1, clearProps: "willChange" });
    gsap.set([this.nav, ...(this.intro || [])].filter(Boolean), { opacity: 1, y: 0 });
    if (this.stage) gsap.set(this.stage, { opacity: 1 });
    return this;
  }

  replay() {
    this.stopScroll();
    if (this.timeline) this.timeline.kill();
    if (this.introTl) this.introTl.kill();
    this.progress = -1;
    this.initialize();
    return this.play();
  }

  stopScroll() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  destroy() {
    this.stopScroll();
    if (this.timeline) this.timeline.kill();
    if (this.introTl) this.introTl.kill();
    this.timeline = null;
    this.tiles = [];
  }
}
