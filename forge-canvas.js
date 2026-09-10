/* <forge-object mode="capture|imagine|prototype|make|rotate|explode|slice|scan|build">
   Projected wireframe gateway, ported from the Digital Forge archive.
   Attributes: mode, ink, accent, dim (both hex/rgb strings). Drag to turn. */
(function () {
  "use strict";
  if (window.customElements && customElements.get("forge-object")) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  function buildGeo() {
    var W = 1.0, H = 1.62, arch = 0.95, D = 0.6, N = 16;
    var prof = [[-W, -H], [-W, H - arch]];
    for (var i = 0; i <= N; i++) {
      var t = Math.PI * (1 - i / N);
      prof.push([W * Math.cos(t), (H - arch) + arch * Math.sin(t)]);
    }
    prof.push([W, -H]);
    var V = [], E = [], front = [], back = [];
    prof.forEach(function (p) { front.push(V.push([p[0], p[1], D]) - 1); });
    prof.forEach(function (p) { back.push(V.push([p[0], p[1], -D]) - 1); });
    for (var k = 0; k < prof.length; k++) {
      var j = (k + 1) % prof.length;
      E.push([front[k], front[j]]);
      E.push([back[k], back[j]]);
      E.push([front[k], back[k]]);
    }
    var grp = V.map(function (v) { return v[1] < -H * 0.32 ? 0 : (v[1] < H - arch ? 1 : 2); });
    var cloud = [], seed = 1;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    E.forEach(function (e, ei) {
      for (var s = 0; s < 7; s++) {
        cloud.push({ e: ei, t: s / 6, jx: rnd() - 0.5, jy: rnd() - 0.5, jz: rnd() - 0.5 });
      }
    });
    return { V: V, E: E, grp: grp, cloud: cloud, W: W, H: H, arch: arch, D: D };
  }
  var GEO = buildGeo();

  function project(p, ang, tilt, f) {
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var x = p[0] * ca + p[2] * sa, z = -p[0] * sa + p[2] * ca, y = p[1];
    var ct = Math.cos(tilt), st = Math.sin(tilt);
    var y2 = y * ct - z * st, z2 = y * st + z * ct, s = f / (f - z2);
    return [x * s, y2 * s, z2, s];
  }
  function widthAt(y) {
    var W = GEO.W, H = GEO.H, arch = GEO.arch;
    if (y <= H - arch) return W;
    var u = (y - (H - arch)) / arch;
    return u >= 1 ? 0.001 : W * Math.sqrt(Math.max(0, 1 - u * u));
  }

  function ForgeObject() { return Reflect.construct(HTMLElement, [], ForgeObject); }
  ForgeObject.prototype = Object.create(HTMLElement.prototype);
  ForgeObject.prototype.constructor = ForgeObject;
  Object.setPrototypeOf(ForgeObject, HTMLElement);

  Object.defineProperty(ForgeObject, "observedAttributes", { get: function () { return ["mode", "ink", "accent", "dim"]; } });

  ForgeObject.prototype.connectedCallback = function () {
    if (this._ready) return;
    this._ready = true;
    var host = this;
    if (!host.style.display) host.style.display = "block";
    host.style.position = host.style.position || "relative";
    host.style.touchAction = "pan-y";

    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab";
    host.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, running = false, raf = 0, t0 = performance.now();
    var ang = 0.6, tilt = 0.34, dragging = false, lastX = 0, lastY = 0, spinPaused = false;

    function pal() {
      return {
        line: host.getAttribute("ink") || "rgba(17,24,39,0.42)",
        strong: host.getAttribute("ink") ? host.getAttribute("ink") : "rgba(17,24,39,0.78)",
        pt: host.getAttribute("accent") || "#18A6A0",
        accent: host.getAttribute("accent") || "#18A6A0",
        hatch: host.getAttribute("dim") || "rgba(17,24,39,0.16)"
      };
    }
    function resize() {
      var r = host.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.max(1, w * dpr); canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function line(a, b, alpha, col, wd) {
      ctx.strokeStyle = col; ctx.globalAlpha = alpha; ctx.lineWidth = wd || 1;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      if (!w || !h) resize();
      var tt = (now - t0) / 1000, P = pal();
      ctx.clearRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2, scale = Math.min(w, h) * 0.255, f = 4.2;
      if (!dragging && !spinPaused) ang = 0.6 + tt * 0.42;

      var V = GEO.V, E = GEO.E, grp = GEO.grp, pp = [];
      var m = host.getAttribute("mode") || "rotate";
      var ex = 0, lvl = 0, plane = 0, scan = 0, noiseAmp = 0;
      if (m === "explode" || m === "prototype") ex = (Math.sin(tt * 0.8) * 0.5 + 0.5) * 0.9;
      if (m === "make" || m === "build") lvl = ((tt * 0.28) % 1) * (2 * GEO.H) - GEO.H;
      if (m === "slice") plane = Math.sin(tt * 0.6) * GEO.H * 0.96;
      if (m === "scan" || m === "capture") scan = Math.sin(tt * 0.5 - Math.PI / 2) * 0.5 + 0.5;
      if (m === "imagine") noiseAmp = 0.16 * (0.6 + 0.4 * Math.sin(tt * 0.8));

      for (var i = 0; i < V.length; i++) {
        var v = V[i].slice();
        if (m === "explode" || m === "prototype") { v[1] += (grp[i] - 1) * ex * 0.62; v[2] += (grp[i] - 1) * ex * 0.12; }
        if (m === "imagine") {
          v[0] += Math.sin(tt * 0.7 + i * 1.3) * noiseAmp;
          v[1] += Math.cos(tt * 0.9 + i * 0.7) * noiseAmp;
          v[2] += Math.sin(tt * 1.1 + i * 2.1) * noiseAmp;
        }
        pp[i] = project(v, ang, tilt, f);
      }
      function S(pr) { return [cx + pr[0] * scale, cy - pr[1] * scale]; }

      if (m === "make" || m === "build") {
        for (var y = -GEO.H; y <= lvl; y += 0.11) {
          var wd = widthAt(y);
          line(S(project([-wd, y, 0], ang, tilt, f)), S(project([wd, y, 0], ang, tilt, f)), 0.5, P.hatch, 1);
        }
      }

      for (var e = 0; e < E.length; e++) {
        var ia = E[e][0], ib = E[e][1], A = pp[ia], B = pp[ib];
        var depth = (A[2] + B[2]) / 2;
        var dAlpha = Math.max(0.12, Math.min(0.9, 0.35 + 0.5 * ((depth + 1.4) / 2.8)));
        if ((m === "explode" || m === "prototype") && grp[ia] !== grp[ib] && ex > 0.06) continue;
        if ((m === "make" || m === "build") && (V[ia][1] > lvl || V[ib][1] > lvl)) continue;
        if (m === "slice") {
          var ya = V[ia][1], yb = V[ib][1];
          if (ya > plane && yb > plane) continue;
          if ((ya > plane) !== (yb > plane)) {
            var f2 = (plane - ya) / (yb - ya);
            var mid = [V[ia][0] + (V[ib][0] - V[ia][0]) * f2, plane, V[ia][2] + (V[ib][2] - V[ia][2]) * f2];
            line(S(ya <= plane ? A : B), S(project(mid, ang, tilt, f)), dAlpha, P.strong, 1);
            continue;
          }
        }
        if (m === "scan" || m === "capture") { line(S(A), S(B), dAlpha * (1 - scan) * 0.9, P.line, 1); continue; }
        line(S(A), S(B), dAlpha, m === "imagine" ? P.line : P.strong, m === "imagine" ? 1 : 1.15);
      }

      if (m === "imagine") {
        for (var q = 0; q < E.length; q++) {
          if (Math.sin(tt * 2.4 + q * 11) > 0.72) line(S(pp[E[q][0]]), S(pp[E[q][1]]), 0.9, P.accent, 1.4);
        }
      }

      if ((m === "scan" || m === "capture") && scan > 0.01) {
        ctx.fillStyle = P.pt;
        for (var c = 0; c < GEO.cloud.length; c++) {
          var cl = GEO.cloud[c], ee = E[cl.e], va = V[ee[0]], vb = V[ee[1]];
          var pr = project([
            va[0] + (vb[0] - va[0]) * cl.t + cl.jx * 0.45 * scan,
            va[1] + (vb[1] - va[1]) * cl.t + cl.jy * 0.45 * scan,
            va[2] + (vb[2] - va[2]) * cl.t + cl.jz * 0.45 * scan
          ], ang, tilt, f);
          var sp = S(pr), rad = 0.9 + pr[3] * 0.6;
          ctx.globalAlpha = 0.35 + 0.5 * scan;
          ctx.fillRect(sp[0] - rad / 2, sp[1] - rad / 2, rad, rad);
        }
        ctx.globalAlpha = 1;
      }

      if (m === "slice") {
        var wd2 = widthAt(plane);
        var corners = [[-wd2, plane, GEO.D], [wd2, plane, GEO.D], [wd2, plane, -GEO.D], [-wd2, plane, -GEO.D]];
        ctx.strokeStyle = P.pt; ctx.globalAlpha = 0.9; ctx.lineWidth = 1.4; ctx.beginPath();
        for (var k2 = 0; k2 < 4; k2++) {
          var pc = S(project(corners[k2], ang, tilt, f));
          if (k2 === 0) ctx.moveTo(pc[0], pc[1]); else ctx.lineTo(pc[0], pc[1]);
        }
        ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1;
      }

      if ((m === "explode" || m === "prototype") && ex > 0.05) {
        ctx.setLineDash([1, 5]);
        line(S(project([0, -2, 0], ang, tilt, f)), S(project([0, 2, 0], ang, tilt, f)), 0.22 * ex, P.accent, 1);
        ctx.setLineDash([]);
      }

      if (running) raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      if (reduce.matches) { frame(performance.now()); return; }
      running = true;
      raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }
    this._start = start; this._stop = stop;
    this._redraw = function () { if (!running) frame(performance.now()); };

    canvas.addEventListener("pointerdown", function (ev) {
      dragging = true; spinPaused = true; lastX = ev.clientX; lastY = ev.clientY;
      canvas.style.cursor = "grabbing";
      if (canvas.setPointerCapture) canvas.setPointerCapture(ev.pointerId);
    });
    canvas.addEventListener("pointermove", function (ev) {
      if (!dragging) return;
      ang += (ev.clientX - lastX) * 0.01;
      tilt = Math.max(-0.9, Math.min(1.1, tilt + (ev.clientY - lastY) * 0.006));
      lastX = ev.clientX; lastY = ev.clientY;
      if (!running) frame(performance.now());
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false; canvas.style.cursor = "grab";
      t0 = performance.now() - (ang - 0.6) / 0.42 * 1000;
      setTimeout(function () { spinPaused = false; }, 900);
    }
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerleave", endDrag);

    var ro = window.ResizeObserver ? new ResizeObserver(function () { resize(); if (!running) frame(performance.now()); }) : null;
    if (ro) ro.observe(host); else window.addEventListener("resize", resize);

    resize();
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) start(); else stop(); });
      }, { threshold: 0.05 });
      io.observe(host);
    } else start();
  };

  ForgeObject.prototype.disconnectedCallback = function () { if (this._stop) this._stop(); };
  ForgeObject.prototype.attributeChangedCallback = function (name) {
    if (name === "mode") { this._t0Reset = true; }
    if (this._redraw) this._redraw();
  };
  ForgeObject.prototype.setMode = function (m) { this.setAttribute("mode", m); };

  customElements.define("forge-object", ForgeObject);
})();
