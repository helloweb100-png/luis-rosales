/* ==========================================================================
   LUIS ROSALES · Diseño y construcción — script.js
   Sin librerías: todo es JavaScript propio (la página no depende de ninguna CDN).

   Contenido
   01 Configuración (número de WhatsApp: una sola constante)
   02 Utilidades
   03 Motor 3D de la obra en canvas (hero y método)
   04 Cargador y arranque
   05 Revelado de texto y bloques
   06 Motor de scroll (progreso, cota, manifiesto, imagen que se abre, método)
   07 Interacciones (menú, servicios, tilt, imanes, cursor, FAQ)
   08 Formulario → WhatsApp
   ========================================================================== */
(() => {
  'use strict';

  /* ─────────────── 01 · CONFIGURACIÓN ─────────────── */
  // Número de WhatsApp: 52 + 10 dígitos, sin signos. Si queda vacío, el botón flotante
  // y el envío del formulario se ocultan con elegancia.
  const WHATSAPP_NUMERO = '528661076364';
  const MENSAJE_BASE = 'Hola Luis, vi tu página web y quiero platicar mi proyecto.';

  /* ─────────────── 02 · UTILIDADES ─────────────── */
  const doc = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const rnd = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const mqReducir = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducir = mqReducir.matches;
  const punteroFino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const esAncho = () => window.innerWidth >= 1000;

  /* ─────────────── 03 · MOTOR 3D DE LA OBRA ───────────────
     Un edificio en estructura alámbrica con grúa torre, polvo dorado, chispas y
     anotaciones. Se proyecta a mano (sin WebGL): ligero y sin dependencias. */
  const PALETA_ORO = { line: [226, 181, 60], hi: [251, 233, 168], win: [247, 221, 138], grid: [226, 181, 60], add: true };
  const PALETA_TINTA = { line: [19, 17, 12], hi: [138, 100, 10], win: [196, 146, 26], grid: [19, 17, 12], add: false };
  const NIVELES_ALPHA = [0.25, 0.45, 0.72, 1];

  function crearSprite(rgb) {
    const s = document.createElement('canvas');
    s.width = s.height = 48;
    const c = s.getContext('2d');
    const g = c.createRadialGradient(24, 24, 0, 24, 24, 24);
    const col = rgb.join(',');
    g.addColorStop(0, `rgba(${col},1)`);
    g.addColorStop(0.22, `rgba(${col},.55)`);
    g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, 48, 48);
    return s;
  }

  class Obra {
    constructor(canvas, opts = {}) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.o = Object.assign({
        floors: 9, pal: PALETA_ORO, labels: false, dust: 60, autoGrow: false, auto: true,
        anchorWide: [0.7, 0.54], anchorNarrow: 0.56, scale: 1, grid: true,
      }, opts);
      this.N = this.o.floors;
      this.H = 0.55;
      this.camD = 18;
      this.cy = this.N * this.H * 0.5;
      this.t = 0;
      this.t0 = null;                       // instante en que arranca el crecimiento automático
      this.g = this.o.autoGrow ? 0 : this.N; // pisos construidos
      this.ghost = 0.3;                     // opacidad del edificio fantasma (plano)
      this.win = this.o.autoGrow ? 0 : 1;   // ventanas encendidas
      this.yaw = -0.75;
      this.pitch = 0.5;
      this.craneBias = 0;
      this.pointer = [0, 0];
      this.pointerS = [0, 0];
      this.visible = false;
      this.B = Array.from({ length: 5 }, () => [[], [], [], []]);
      this.p1 = [0, 0, 0];
      this.p2 = [0, 0, 0];
      this.q = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
      this.sprite = crearSprite(this.o.pal.win);
      this.cols = [[-1.5, -1], [-0.5, -1], [0.5, -1], [1.5, -1], [-1.5, 1], [-0.5, 1], [0.5, 1], [1.5, 1], [-1.5, 0], [1.5, 0]];
      this.dust = [];
      for (let i = 0; i < this.o.dust; i++) this.dust.push(this.nuevoPolvo(true));
      this.sparks = [];
      this.labelA = [0, 0, 0];
      this.beacon = [0, 0];
      this.fit();
    }

    nuevoPolvo(inicio) {
      const top = this.N * this.H;
      return {
        x: (Math.random() - 0.5) * 11, y: inicio ? Math.random() * (top + 3) : -0.2,
        z: (Math.random() - 0.5) * 9, vy: 0.14 + Math.random() * 0.32, s: 0.5 + Math.random(), ph: Math.random() * 6.28,
      };
    }

    fit() {
      const r = this.cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, r.width > 800 ? 2 : 1.6);
      this.cw = Math.max(1, r.width);
      this.ch = Math.max(1, r.height);
      this.cv.width = Math.round(this.cw * dpr);
      this.cv.height = Math.round(this.ch * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.wideMode = this.cw > 880;
      const base = Math.min(this.cw / (this.wideMode ? 12 : 8.4), this.ch / (this.wideMode ? 10.2 : 10.4));
      this.unit = base * this.o.scale;
      this.ax = this.cw * (this.wideMode ? this.o.anchorWide[0] : 0.5);
      this.ay = this.ch * (this.wideMode ? this.o.anchorWide[1] : this.o.anchorNarrow);
    }

    proj(x, y, z, out) {
      y -= this.cy;
      const X = x * this.cY - z * this.sY;
      const Z = x * this.sY + z * this.cY;
      const Y = y * this.cP + Z * this.sP;
      const D = -y * this.sP + Z * this.cP;
      const f = this.camD / (this.camD + D);
      out[0] = this.ax + X * f * this.unit;
      out[1] = this.ay - Y * f * this.unit;
      out[2] = D;
    }

    seg(L, x1, y1, z1, x2, y2, z2) {
      const a = this.p1, b = this.p2;
      this.proj(x1, y1, z1, a);
      this.proj(x2, y2, z2, b);
      const t = 1 - ((a[2] + b[2]) * 0.5 + 5.5) / 13;
      const lv = t > 0.78 ? 3 : t > 0.55 ? 2 : t > 0.32 ? 1 : 0;
      this.B[L][lv].push(a[0], a[1], b[0], b[1]);
    }

    rect(L, y, x0, z0, x1, z1) {
      this.seg(L, x0, y, z0, x1, y, z0);
      this.seg(L, x1, y, z0, x1, y, z1);
      this.seg(L, x1, y, z1, x0, y, z1);
      this.seg(L, x0, y, z1, x0, y, z0);
    }

    box(L, x0, y0, z0, x1, y1, z1) {
      this.rect(L, y0, x0, z0, x1, z1);
      this.rect(L, y1, x0, z0, x1, z1);
      this.seg(L, x0, y0, z0, x0, y1, z0);
      this.seg(L, x1, y0, z0, x1, y1, z0);
      this.seg(L, x1, y0, z1, x1, y1, z1);
      this.seg(L, x0, y0, z1, x0, y1, z1);
    }

    flush(L, rgb, alpha, lw, dash, glow) {
      const ctx = this.ctx;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.setLineDash(dash || []);
      if (glow) { ctx.shadowColor = `rgba(${rgb.join(',')},.9)`; ctx.shadowBlur = glow; }
      for (let lv = 0; lv < 4; lv++) {
        const arr = this.B[L][lv];
        if (!arr.length) continue;
        ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(alpha * NIVELES_ALPHA[lv]).toFixed(3)})`;
        ctx.beginPath();
        for (let i = 0; i < arr.length; i += 4) { ctx.moveTo(arr[i], arr[i + 1]); ctx.lineTo(arr[i + 2], arr[i + 3]); }
        ctx.stroke();
        arr.length = 0;
      }
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
    }

    /** Anillo en el suelo (pulso tipo radar). */
    anillo(r, alpha, rgb) {
      const ctx = this.ctx, p = this.p1;
      ctx.beginPath();
      for (let i = 0; i <= 56; i++) {
        const a = (i / 56) * Math.PI * 2;
        this.proj(Math.cos(a) * r, 0, Math.sin(a) * r, p);
        if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      }
      ctx.strokeStyle = `rgba(${rgb.join(',')},${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    ventana(a, b, c, d, semilla, alphaBase) {
      const ctx = this.ctx, q = this.q;
      this.proj(a[0], a[1], a[2], q[0]); this.proj(b[0], b[1], b[2], q[1]);
      this.proj(c[0], c[1], c[2], q[2]); this.proj(d[0], d[1], d[2], q[3]);
      const prof = clamp(1 - (q[0][2] + 5.5) / 13, 0.2, 1);
      const r = rnd(semilla * 1.7 + 3);
      const tw = 0.55 + 0.45 * Math.sin(this.t * (0.7 + r) + semilla);
      const al = alphaBase * prof * (r < 0.3 ? 0.1 : 0.12 + 0.4 * tw);
      const w = this.o.pal.win;
      ctx.fillStyle = `rgba(${w[0]},${w[1]},${w[2]},${al.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.lineTo(q[3][0], q[3][1]);
      ctx.closePath();
      ctx.fill();
    }

    ventanas(alphaBase) {
      if (alphaBase < 0.02) return;
      const N = this.N, H = this.H;
      const xs = [-1.5, -0.5, 0.5, 1.5], zs = [-1, 0, 1];
      for (let k = 0; k < N; k++) {
        if (this.g - k < 1) break;
        const yA = k * H + H * 0.2, yB = k * H + H * 0.78;
        for (let s = 0; s < 2; s++) {
          const z = s ? -1 : 1;
          for (let i = 0; i < 3; i++) this.ventana([xs[i] + 0.1, yA, z], [xs[i + 1] - 0.1, yA, z], [xs[i + 1] - 0.1, yB, z], [xs[i] + 0.1, yB, z], k * 7 + i + s * 3, alphaBase);
        }
        for (let s = 0; s < 2; s++) {
          const x = s ? -1.5 : 1.5;
          for (let i = 0; i < 2; i++) this.ventana([x, yA, zs[i] + 0.1], [x, yA, zs[i + 1] - 0.1], [x, yB, zs[i + 1] - 0.1], [x, yB, zs[i] + 0.1], k * 7 + i + 10 + s * 2, alphaBase);
        }
      }
    }

    grua(top) {
      const t = this.t, L = 3.1;
      const CX = 2.25, CZ = -1.45, s = 0.13;
      const co = [[-s, -s], [s, -s], [s, s], [-s, s]];
      // Torre reticulada
      for (let i = 0; i < 4; i++) {
        const a = co[i], b = co[(i + 1) % 4];
        this.seg(3, CX + a[0], 0, CZ + a[1], CX + a[0], top, CZ + a[1]);
        let j = 0;
        for (let y = 0; y < top - 0.01; y += 0.34, j++) {
          const y2 = Math.min(top, y + 0.34);
          if ((i + j) % 2 === 0) this.seg(3, CX + a[0], y, CZ + a[1], CX + b[0], y2, CZ + b[1]);
          else this.seg(3, CX + b[0], y, CZ + b[1], CX + a[0], y2, CZ + a[1]);
        }
      }
      for (let y = 0.34; y < top; y += 1.36) this.rect(3, y, CX - s, CZ - s, CX + s, CZ + s);

      // Pluma giratoria
      const ang = -0.5 + Math.sin(t * 0.28) * 0.9 + this.craneBias;
      const ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux;
      const P = (d, l, y) => [CX + ux * d + vx * l, y, CZ + uz * d + vz * l];
      const S = (A, B, L2 = 3) => this.seg(L2, A[0], A[1], A[2], B[0], B[1], B[2]);
      const yT = top;
      const yTop = (d) => yT + 0.2 * (1 - d / L) + 0.02;
      S(P(-1.15, 0.08, yT), P(L, 0.08, yT));
      S(P(-1.15, -0.08, yT), P(L, -0.08, yT));
      S(P(0, 0, yTop(0)), P(L, 0, yTop(L)));
      let k = 0;
      for (let d = 0; d < L - 0.2; d += 0.32, k++) {
        const d2 = Math.min(L, d + 0.32);
        if (k % 2 === 0) S(P(d, 0, yT), P(d2, 0, yTop(d2))); else S(P(d, 0, yTop(d)), P(d2, 0, yT));
        S(P(d, 0.08, yT), P(d, -0.08, yT));
      }
      const apex = P(0, 0, yT + 1);
      S(apex, P(0, 0, yT));
      S(apex, P(L * 0.78, 0, yTop(L * 0.78)));
      S(apex, P(-1.05, 0, yT));
      // Contrapeso y cabina
      const bx = (d0, d1, l0, l1, y0, y1) => {
        const c = [P(d0, l0, y0), P(d1, l0, y0), P(d1, l1, y0), P(d0, l1, y0), P(d0, l0, y1), P(d1, l0, y1), P(d1, l1, y1), P(d0, l1, y1)];
        for (let i = 0; i < 4; i++) { S(c[i], c[(i + 1) % 4]); S(c[4 + i], c[4 + (i + 1) % 4]); S(c[i], c[4 + i]); }
      };
      bx(-1.15, -0.8, -0.13, 0.13, yT - 0.22, yT);
      bx(0.22, 0.52, 0.1, 0.24, yT - 0.24, yT);

      // Carro, cable y carga
      const r = 1.2 + (0.5 + 0.5 * Math.sin(t * 0.5)) * (L - 1.7);
      const hookY = Math.max(0.35, yT - 0.9 - (0.5 + 0.5 * Math.sin(t * 0.7 + 1)) * Math.max(0.8, yT * 0.55));
      const sw = Math.sin(t * 1.6) * 0.05;
      const T = P(r, 0, yT);
      const Hk = P(r + sw * 2, sw * 2, hookY);
      S(T, Hk, 4);
      this.box(4, Hk[0] - 0.12, Hk[1] - 0.24, Hk[2] - 0.12, Hk[0] + 0.12, Hk[1] - 0.02, Hk[2] + 0.12);
      this.seg(4, Hk[0], Hk[1], Hk[2], Hk[0] - 0.1, Hk[1] - 0.04, Hk[2] - 0.1);
      this.seg(4, Hk[0], Hk[1], Hk[2], Hk[0] + 0.1, Hk[1] - 0.04, Hk[2] + 0.1);
      // Baliza en la punta
      const tip = P(L, 0, yT + 0.03);
      this.proj(tip[0], tip[1], tip[2], this.p2);
      this.beacon[0] = this.p2[0];
      this.beacon[1] = this.p2[1];
    }

    polvoYChispas(dt) {
      const ctx = this.ctx, o = this.o, N = this.N, H = this.H, p = this.p1;
      ctx.globalCompositeOperation = o.pal.add ? 'lighter' : 'source-over';
      const top = N * H;
      for (const d of this.dust) {
        d.y += d.vy * dt;
        d.x += Math.sin(this.t * 0.4 + d.ph) * 0.03 * dt * 10;
        if (d.y > top + 3) Object.assign(d, this.nuevoPolvo(false));
        this.proj(d.x, d.y, d.z, p);
        const f = clamp(1 - (p[2] + 6) / 14, 0.15, 1);
        const tw = 0.5 + 0.5 * Math.sin(this.t * 1.3 + d.ph);
        const r = (3 + d.s * 5) * f * (this.unit / 60);
        ctx.globalAlpha = (o.pal.add ? 0.6 : 0.5) * f * tw;
        ctx.drawImage(this.sprite, p[0] - r, p[1] - r, r * 2, r * 2);
      }
      // Chispas de soldadura en el piso que se está construyendo
      if (dt > 0 && this.g > 0.15 && this.g < N - 0.05 && this.sparks.length < 60 && Math.random() < dt * 40) {
        const lvl = Math.floor(this.g) * H + (this.g % 1) * H;
        const lado = Math.random() * 4 | 0;
        const u = Math.random();
        const x = lado < 2 ? -1.5 + u * 3 : (lado === 2 ? -1.5 : 1.5);
        const z = lado < 2 ? (lado ? -1 : 1) : -1 + u * 2;
        this.sparks.push({ x, y: lvl, z, vx: (Math.random() - 0.5) * 1.4, vy: 0.6 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 1.4, life: 1 });
      }
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i];
        s.vy -= 5 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.life -= dt * 1.7;
        if (s.life <= 0 || s.y < 0) { this.sparks.splice(i, 1); continue; }
        this.proj(s.x, s.y, s.z, p);
        const r = 5 * (this.unit / 60) * (0.5 + s.life);
        ctx.globalAlpha = clamp(s.life) * 0.9;
        ctx.drawImage(this.sprite, p[0] - r, p[1] - r, r * 2, r * 2);
      }
      // Baliza de la grúa
      const pulso = 0.5 + 0.5 * Math.sin(this.t * 3.2);
      const rb = (6 + pulso * 7) * (this.unit / 60);
      ctx.globalAlpha = 0.35 + pulso * 0.65;
      ctx.drawImage(this.sprite, this.beacon[0] - rb, this.beacon[1] - rb, rb * 2, rb * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    anotaciones(dt) {
      const ctx = this.ctx, N = this.N, H = this.H, pal = this.o.pal;
      const defs = [
        { t: '01 · CIMENTACIÓN', p: [1.5, 0, 1], dx: 1, dy: 34, on: this.g > 0.8 },
        { t: '02 · ESTRUCTURA', p: [-1.5, N * H * 0.55, 1], dx: -1, dy: -4, on: this.g > N * 0.6 },
        { t: '03 · ACABADOS', p: [0, N * H + 0.4, 0], dx: 1, dy: -34, on: this.win > 0.35 },
      ];
      const px = this.wideMode ? 11 : 9.5;
      ctx.font = `500 ${px}px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`;
      ctx.textBaseline = 'alphabetic';
      defs.forEach((d, i) => {
        this.labelA[i] = lerp(this.labelA[i], d.on ? 1 : 0, 1 - Math.exp(-dt * 3));
        const a = this.labelA[i];
        if (a < 0.03) return;
        this.proj(d.p[0], d.p[1], d.p[2], this.p1);
        const sx = this.p1[0], sy = this.p1[1];
        const tw = ctx.measureText(d.t).width;
        const len = this.wideMode ? 64 : 34;
        let dir = d.dx;
        const fits = (dd) => { const ex = sx + dd * len; const tx = dd > 0 ? ex + 6 : ex - 6 - tw; return tx > 6 && tx + tw < this.cw - 6; };
        if (!fits(dir)) dir = -dir;
        if (!fits(dir)) return;
        const ex = sx + dir * len, ey = sy + d.dy;
        const col = pal.hi.join(',');
        ctx.globalAlpha = a;
        ctx.strokeStyle = `rgba(${col},.85)`;
        ctx.fillStyle = `rgba(${col},.95)`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(ex + dir * (tw + 12), ey); ctx.stroke();
        ctx.beginPath(); ctx.arc(sx, sy, 3, 0, 6.283); ctx.fill();
        const pu = (this.t * 0.8 + i * 0.4) % 1;
        ctx.strokeStyle = `rgba(${col},${(1 - pu) * 0.7})`;
        ctx.beginPath(); ctx.arc(sx, sy, 3 + pu * 12, 0, 6.283); ctx.stroke();
        ctx.fillStyle = `rgba(${col},1)`;
        const tx = dir > 0 ? ex + 6 : ex - 6 - tw;
        ctx.fillText(d.t, tx, ey - 6);
        ctx.globalAlpha = 1;
      });
    }

    frame(dt) {
      this.t += dt;
      const o = this.o, N = this.N, H = this.H, pal = o.pal, ctx = this.ctx;

      if (o.autoGrow) {
        if (this.t0 !== null) {
          const a = clamp((this.t - this.t0 - 0.3) / 8.5);
          this.g = N * (a < 0.5 ? 2 * a * a : 1 - Math.pow(-2 * a + 2, 2) / 2);
          this.win = smooth(clamp((a - 0.82) / 0.18));
          this.ghost = lerp(0.34, 0.12, smooth(a));
        } else { this.g = 0; this.win = 0; this.ghost = 0.34; }
      }
      if (o.auto) this.yaw += dt * 0.13;
      this.pointerS[0] = lerp(this.pointerS[0], this.pointer[0], 1 - Math.exp(-dt * 3));
      this.pointerS[1] = lerp(this.pointerS[1], this.pointer[1], 1 - Math.exp(-dt * 3));
      const yaw = this.yaw + this.pointerS[0] * 0.5;
      const pitch = this.pitch + this.pointerS[1] * 0.16;
      this.cY = Math.cos(yaw); this.sY = Math.sin(yaw); this.cP = Math.cos(pitch); this.sP = Math.sin(pitch);

      ctx.clearRect(0, 0, this.cw, this.ch);
      const g = this.g, topY = N * H;

      // 1 · Suelo: cuadrícula, anillos de radar y lindero del terreno
      if (o.grid) {
        const R = this.wideMode ? 7 : 6;
        for (let i = -R; i <= R; i++) {
          this.seg(0, i, 0, -R, i, 0, R);
          this.seg(0, -R, 0, i, R, 0, i);
        }
        this.flush(0, pal.grid, pal.add ? 0.2 : 0.16, 1);
        const ph = (this.t * 0.22) % 1;
        this.anillo(2.7 + ph * 4.3, (1 - ph) * (pal.add ? 0.35 : 0.3), pal.grid);
        this.anillo(2.7 + ((ph + 0.5) % 1) * 4.3, (1 - ((ph + 0.5) % 1)) * (pal.add ? 0.22 : 0.2), pal.grid);
      }
      this.rect(4, 0, -3.5, -2.7, 3.5, 2.7);
      // Cota (línea de dimensión) al frente del edificio
      this.seg(4, -1.5, 0, 1.75, 1.5, 0, 1.75);
      this.seg(4, -1.5, 0, 1.6, -1.5, 0, 1.9);
      this.seg(4, 1.5, 0, 1.6, 1.5, 0, 1.9);
      this.seg(4, -1.9, 0, -1, -1.9, 0, 1);
      this.seg(4, -2.0, 0, -1, -1.8, 0, -1);
      this.seg(4, -2.0, 0, 1, -1.8, 0, 1);

      // 2 · Edificio fantasma (plano)
      const gh = this.ghost;
      if (gh > 0.01) {
        for (let k = 0; k <= N; k++) this.rect(1, k * H, -1.5, -1, 1.5, 1);
        this.seg(1, -1.5, 0, -1, -1.5, topY, -1); this.seg(1, 1.5, 0, -1, 1.5, topY, -1);
        this.seg(1, -1.5, 0, 1, -1.5, topY, 1); this.seg(1, 1.5, 0, 1, 1.5, topY, 1);
        this.flush(1, pal.line, gh, 1, [3, 6]);
      }

      // 3 · Edificio real: columnas, losas y ventanas
      for (let k = 0; k < N; k++) {
        const a = clamp(g - k);
        if (a <= 0) break;
        const y0 = k * H, y1 = y0 + a * H;
        for (const c of this.cols) this.seg(2, c[0], y0, c[1], c[0], y1, c[1]);
        if (k === 0) this.rect(2, 0, -1.5, -1, 1.5, 1);
        this.rect(a < 1 ? 4 : 2, y1, -1.5, -1, 1.5, 1);
        if (a < 1) { this.seg(4, -1.5, y1, -1, 1.5, y1, 1); this.seg(4, 1.5, y1, -1, -1.5, y1, 1); }
      }
      this.ventanas(this.win * (pal.add ? 1 : 1.25));
      if (g >= N - 0.001) {
        this.box(2, -0.55, topY, -0.35, 0.55, topY + 0.32, 0.35);
        this.seg(2, 0, topY + 0.32, 0, 0, topY + 0.8, 0);
      }
      this.flush(2, pal.line, pal.add ? 0.9 : 0.85, 1.3);

      // 4 · Pulsos de luz que suben por las columnas
      if (this.win > 0.4) {
        let i = 0;
        for (const c of this.cols) {
          const ph = ((this.t * 1.25 + i * 0.9) % (topY + 2.2)) - 0.8;
          const y0 = clamp(ph, 0, topY), y1 = clamp(ph + 0.8, 0, topY);
          if (y1 - y0 > 0.02) this.seg(4, c[0], y0, c[1], c[0], y1, c[1]);
          i++;
        }
      }

      // 5 · Grúa torre
      const cg = clamp((g + 1) / (N + 1));
      this.grua(1.5 + cg * (topY + 0.75));
      this.flush(3, pal.line, pal.add ? 0.88 : 0.85, 1.1);
      this.flush(4, pal.hi, 1, 1.6, null, pal.add ? 14 : 0);

      // 6 · Polvo dorado, chispas y baliza
      this.polvoYChispas(dt);

      // 7 · Anotaciones (solo hero)
      if (o.labels) this.anotaciones(dt);
    }
  }

  /* Motores activos: solo se dibujan mientras están visibles en pantalla */
  const motores = [];
  function registrarMotor(canvas, opts) {
    if (!canvas || !canvas.getContext) return null;
    let motor;
    try { motor = new Obra(canvas, opts); } catch (e) { return null; }
    motores.push(motor);
    if ('ResizeObserver' in window) new ResizeObserver(() => { motor.fit(); if (reducir) motor.frame(0); }).observe(canvas);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { motor.visible = es[0].isIntersecting; }, { rootMargin: '120px' }).observe(canvas);
    } else motor.visible = true;
    return motor;
  }

  /* ─────────────── 04 · CARGADOR Y ARRANQUE ─────────────── */
  let paginaIniciada = false;
  let heroMotor = null;

  function iniciarPagina() {
    if (paginaIniciada) return;
    paginaIniciada = true;
    doc.classList.add('is-ready');
    iniciarReveal();
    if (heroMotor) heroMotor.t0 = heroMotor.t;
  }

  function iniciarCargador() {
    const loader = $('#cargador');
    if (!loader) { iniciarPagina(); return; }
    const pct = $('[data-loader-pct]', loader);
    const DURACION = reducir ? 500 : 1500;
    const inicio = performance.now();
    let cerrado = false;
    const cerrar = () => {
      if (cerrado) return;
      cerrado = true;
      loader.classList.add('is-out');
      document.body.classList.remove('cargando');
      iniciarPagina();
      setTimeout(() => loader.remove(), 1300);
    };
    const tope = setTimeout(cerrar, 2100); // nunca más de ~2 s
    const paso = (ahora) => {
      const p = clamp((ahora - inicio) / DURACION);
      if (pct) pct.textContent = String(Math.round(smooth(p) * 100));
      if (p < 1) { requestAnimationFrame(paso); return; }
      if (document.readyState === 'complete') { clearTimeout(tope); cerrar(); }
      else window.addEventListener('load', () => { clearTimeout(tope); cerrar(); }, { once: true });
    };
    requestAnimationFrame(paso);
  }

  /* ─────────────── 05 · REVELADO DE TEXTO Y BLOQUES ─────────────── */
  function dividirPalabras(el) {
    let n = 0;
    const recorrer = (nodo) => {
      Array.from(nodo.childNodes).forEach((h) => {
        if (h.nodeType === 3) {
          const frag = document.createDocumentFragment();
          h.textContent.split(/(\s+)/).forEach((parte) => {
            if (!parte) return;
            if (/^\s+$/.test(parte)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = parte;
            wi.style.setProperty('--i', String(n++));
            w.appendChild(wi); frag.appendChild(w);
          });
          h.replaceWith(frag);
        } else if (h.nodeType === 1) recorrer(h);
      });
    };
    recorrer(el);
  }

  function prepararTextos() {
    $$('[data-split]').forEach(dividirPalabras);
    $$('[data-reveal]').forEach((el) => { if (el.dataset.delay) el.style.setProperty('--d', el.dataset.delay); });
  }

  function iniciarReveal() {
    const els = $$('[data-reveal], [data-split]');
    if (reducir || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
    els.forEach((e) => io.observe(e));
  }

  /* ─────────────── WhatsApp: todos los enlaces salen de la constante ─────────────── */
  const urlWhatsApp = (texto) => `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`;
  const hayWhatsApp = /^\d{10,15}$/.test(WHATSAPP_NUMERO);

  function iniciarWhatsApp() {
    $$('[data-wa]').forEach((a) => {
      if (hayWhatsApp) {
        a.href = urlWhatsApp(a.dataset.wa || MENSAJE_BASE);
        a.target = '_blank';
        a.rel = 'noopener';
      } else if (a.classList.contains('wa-flotante') || a.closest('.contacto-datos')) {
        a.hidden = true;
      }
    });
    if (!hayWhatsApp) {
      const envio = $('[data-wa-envio]');
      if (envio) envio.hidden = true;
      const nota = $('[data-wiz-nota]');
      if (nota) nota.textContent = 'Por ahora el envío por WhatsApp no está disponible. Llámanos al 866 107 6364.';
    }
  }

  /* ─────────────── 06 · MOTOR DE SCROLL ─────────────── */
  const sc = { y: 0, vh: window.innerHeight, vw: window.innerWidth, docH: 1, p: 0 };
  const comps = [];                       // cada componente: { medir(), aplicar(dt) }
  const suave = (dt, v = 7) => 1 - Math.exp(-dt * v);

  function compGlobal() {
    const header = $('.site-header');
    const cotaVal = $('[data-cota-valor]');
    const cotaNivel = $('[data-cota-nivel]');
    const secciones = $$('[data-nivel]');
    const links = $$('.nav a');
    let nivelActual = '', scrolled = false, ultimoP = -1;
    let nivelNuevo = '', idNuevo = '';
    return {
      medir() {
        nivelNuevo = ''; idNuevo = '';
        for (const s of secciones) {
          if (s.getBoundingClientRect().top <= sc.vh * 0.45) { nivelNuevo = s.dataset.nivel; idNuevo = s.id; }
        }
      },
      aplicar() {
        const max = Math.max(1, sc.docH - sc.vh);
        sc.p = clamp(sc.y / max);
        if (Math.abs(sc.p - ultimoP) > 0.0004) {
          doc.style.setProperty('--scroll', sc.p.toFixed(4));
          if (cotaVal) cotaVal.textContent = `+${(sc.p * 48).toFixed(2)} m`;
          ultimoP = sc.p;
        }
        const s = sc.y > 24;
        if (s !== scrolled) { scrolled = s; header && header.classList.toggle('is-scrolled', s); }
        if (nivelNuevo !== nivelActual) {
          nivelActual = nivelNuevo;
          if (cotaNivel && nivelActual) cotaNivel.textContent = nivelActual;
          links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${idNuevo}`));
        }
      },
    };
  }

  function compHero() {
    const texto = $('.hero-texto');
    const escena = $('.hero-escena');
    const hero = $('.hero');
    let y = 0;
    return {
      medir() { y = sc.y; },
      aplicar() {
        if (reducir || !hero || y > sc.vh * 1.4) return;
        const ancho = esAncho();
        const t = clamp(y / (sc.vh * 0.9));
        if (texto) { texto.style.transform = ancho ? `translate3d(0,${(-y * 0.1).toFixed(1)}px,0)` : ''; texto.style.opacity = ancho ? String(1 - t * 0.85) : ''; }
        if (escena && ancho) escena.style.transform = `translate3d(0,${(y * 0.16).toFixed(1)}px,0) scale(${(1 + t * 0.08).toFixed(3)})`;
        else if (escena) escena.style.transform = '';
      },
    };
  }

  function compManifiesto() {
    const el = $('[data-scrub-words]');
    if (!el) return null;
    const original = el.textContent.trim();
    const claves = ['idea', 'clara', 'plano', 'honesto', 'equipo', 'diseñamos', 'construimos', 'mismo', 'techo', 'imaginas', 'levanta.'];
    el.textContent = '';
    const palabras = original.split(/\s+/).map((p, i, arr) => {
      const s = document.createElement('span');
      s.className = 'sw' + (claves.includes(p.toLowerCase().replace(/[:,]$/, '')) ? ' hl' : '');
      s.textContent = p;
      el.appendChild(s);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
    const n = palabras.length;
    let obj = 0, cur = reducir ? 1 : 0;
    const pintar = () => {
      palabras.forEach((w, i) => {
        const v = clamp((cur * (n + 5) - i) / 5);
        w.style.opacity = (0.4 + 0.6 * v).toFixed(3);
        w.classList.toggle('lit', v > 0.92);
      });
    };
    pintar();
    return {
      medir() {
        const r = el.getBoundingClientRect();
        obj = reducir ? 1 : clamp((sc.vh * 0.88 - r.top) / (sc.vh * 0.5 + r.height * 0.85));
      },
      aplicar(dt) {
        const nuevo = reducir ? obj : lerp(cur, obj, suave(dt, 6));
        if (Math.abs(nuevo - cur) > 0.0005) { cur = nuevo; pintar(); }
      },
    };
  }

  function compExpandir() {
    const pista = $('[data-expand]');
    if (!pista) return null;
    let obj = 0, cur = 0;
    return {
      medir() {
        const r = pista.getBoundingClientRect();
        const rec = Math.max(1, r.height - sc.vh);
        const p = clamp(-r.top / rec);
        obj = reducir ? 1 : smooth(clamp(p / 0.62));
      },
      aplicar(dt) {
        const nuevo = reducir ? obj : lerp(cur, obj, suave(dt, 9));
        if (Math.abs(nuevo - cur) > 0.0004 || nuevo !== cur) { cur = nuevo; pista.style.setProperty('--e', cur.toFixed(4)); }
      },
    };
  }

  function compMetodo() {
    const pasos = $$('[data-paso]');
    const visual = $('.metodo-visual');
    const canvas = $('#obra-metodo');
    if (!pasos.length || !visual || !canvas) return null;
    const motor = registrarMotor(canvas, {
      pal: PALETA_TINTA, dust: 26, auto: false, scale: 1, anchorWide: [0.5, 0.58], anchorNarrow: 0.6,
    });
    if (!motor) return null;
    motor.g = 0; motor.win = 0; motor.ghost = 0.2;
    const nombres = ['Escuchamos', 'Diseñamos', 'Planeamos', 'Construimos', 'Entregamos'];
    const eN = $('[data-etapa-n]'), eNombre = $('[data-etapa-nombre]'), eCota = $('[data-etapa-cota]');
    let obj = 0, cur = 0, activo = -1, idxNuevo = 0, dibujado = -1;
    const N = motor.N;
    return {
      medir() {
        const vr = visual.getBoundingClientRect();
        const foco = esAncho() ? sc.vh * 0.5 : vr.bottom + (sc.vh - vr.bottom) * 0.4;
        const centros = pasos.map((p) => { const r = p.getBoundingClientRect(); return r.top + r.height / 2; });
        const c0 = centros[0], c1 = centros[centros.length - 1];
        obj = clamp((foco - c0) / Math.max(1, c1 - c0));
        let mejor = 0, dist = 1e9;
        centros.forEach((c, i) => { const d = Math.abs(c - foco); if (d < dist) { dist = d; mejor = i; } });
        idxNuevo = mejor;
      },
      aplicar(dt) {
        cur = reducir ? obj : lerp(cur, obj, suave(dt, 5));
        const p = cur;
        motor.ghost = 0.16 + 0.34 * smooth(clamp((p - 0.08) / 0.3)) * (1 - 0.75 * smooth(clamp((p - 0.5) / 0.4)));
        motor.g = N * smooth(clamp((p - 0.42) / 0.5));
        motor.win = smooth(clamp((p - 0.86) / 0.14));
        motor.yaw = -0.95 + p * 2.5;
        motor.craneBias = p * 1.2;
        if (idxNuevo !== activo) {
          activo = idxNuevo;
          pasos.forEach((el, i) => el.classList.toggle('is-active', i === activo));
          if (eN) eN.textContent = String(activo + 1).padStart(2, '0');
          if (eNombre) eNombre.textContent = nombres[activo];
        }
        if (eCota) eCota.textContent = `+${(motor.g * 3).toFixed(2)} m`;
        // Con movimiento reducido no hay bucle de dibujo: se redibuja solo cuando cambia el avance
        if (reducir && Math.abs(cur - dibujado) > 0.002) { dibujado = cur; motor.labelA = [0, 0, 0]; motor.frame(0); }
      },
    };
  }

  function iniciarScroll() {
    [compGlobal(), compHero(), compManifiesto(), compExpandir(), compMetodo()].forEach((c) => { if (c) comps.push(c); });
    const medirPagina = () => {
      sc.vh = window.innerHeight; sc.vw = window.innerWidth;
      sc.docH = Math.max(document.body.scrollHeight, doc.scrollHeight);
    };
    medirPagina();
    window.addEventListener('resize', medirPagina, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(medirPagina).observe(document.body);
    let ultimo = performance.now();
    const bucle = (ahora) => {
      const dt = Math.max(0, Math.min(0.05, (ahora - ultimo) / 1000));
      ultimo = ahora;
      sc.y = window.scrollY || doc.scrollTop || 0;
      for (const c of comps) c.medir();
      for (const c of comps) c.aplicar(dt);
      if (!reducir) for (const m of motores) { if (m.visible) m.frame(dt); }
      requestAnimationFrame(bucle);
    };
    requestAnimationFrame(bucle);
    if (reducir) motores.forEach((m) => { m.g = m.N; m.win = 1; m.ghost = 0.12; m.frame(0); });
  }

  function iniciarHeroMotor() {
    const canvas = $('#obra-hero');
    heroMotor = registrarMotor(canvas, {
      pal: PALETA_ORO, labels: true, autoGrow: !reducir, dust: window.innerWidth < 700 ? 36 : 70,
      anchorWide: [0.71, 0.56], anchorNarrow: 0.56,
    });
    if (!heroMotor) return;
    if (reducir) { heroMotor.g = heroMotor.N; heroMotor.win = 1; heroMotor.ghost = 0.12; heroMotor.labelA = [1, 1, 1]; heroMotor.frame(0); }
    if (punteroFino) {
      window.addEventListener('pointermove', (e) => {
        heroMotor.pointer[0] = (e.clientX / window.innerWidth - 0.5) * 2;
        heroMotor.pointer[1] = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }
  }

  /* ─────────────── 07 · INTERACCIONES ─────────────── */
  function iniciarMenu() {
    const burger = $('.burger');
    const menu = $('#menu');
    if (!burger || !menu) return;
    const alternar = (abrir) => {
      burger.setAttribute('aria-expanded', String(abrir));
      burger.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
      menu.classList.toggle('is-open', abrir);
      document.body.classList.toggle('menu-abierto', abrir);
      if (abrir) menu.removeAttribute('inert'); else menu.setAttribute('inert', '');
    };
    burger.addEventListener('click', () => alternar(burger.getAttribute('aria-expanded') !== 'true'));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => alternar(false)));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) { alternar(false); burger.focus(); } });
    window.addEventListener('resize', () => { if (esAncho() && menu.classList.contains('is-open')) alternar(false); }, { passive: true });
  }

  function iniciarServicios() {
    const raiz = $('[data-svc]');
    if (!raiz) return;
    const items = $$('[data-svc-item]', raiz);
    let idx = 0, usuario = false, temporizador = null, visible = false;
    const abrir = (i, porUsuario) => {
      idx = i;
      items.forEach((it, j) => {
        const on = i === j;
        it.classList.toggle('is-open', on);
        const b = $('.svc-cab', it);
        if (b) b.setAttribute('aria-expanded', String(on));
      });
      if (porUsuario) { usuario = true; parar(); }
    };
    const parar = () => { if (temporizador) { clearInterval(temporizador); temporizador = null; } };
    const arrancar = () => {
      if (reducir || usuario || temporizador || !visible || !esAncho()) return;
      temporizador = setInterval(() => abrir((idx + 1) % items.length, false), 6500);
    };
    items.forEach((it, i) => { const b = $('.svc-cab', it); if (b) b.addEventListener('click', () => abrir(i, true)); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) arrancar(); else parar(); }, { threshold: 0.35 }).observe(raiz);
    }
    window.addEventListener('resize', () => { if (!esAncho()) parar(); else arrancar(); }, { passive: true });
  }

  function iniciarTilt() {
    if (!punteroFino) return;
    $$('[data-tilt]').forEach((el) => {
      let reposo = null;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
        el.style.transition = 'transform .25s ease-out, border-color .5s';
        el.style.transform = `perspective(900px) rotateX(${((0.5 - y) * 7).toFixed(2)}deg) rotateY(${((x - 0.5) * 9).toFixed(2)}deg) translateZ(0)`;
        clearTimeout(reposo);
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform 1s cubic-bezier(.22,1,.36,1), border-color .5s';
        el.style.transform = '';
        reposo = setTimeout(() => { el.style.transition = ''; }, 1100);
      });
    });
  }

  function iniciarImanes() {
    if (!punteroFino || reducir) return;
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.translate = `${(dx * 0.18).toFixed(1)}px ${(dy * 0.3).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    });
  }

  function iniciarCursor() {
    const cur = $('.cursor');
    if (!cur || !punteroFino || !esAncho() || reducir) return;
    let x = -100, y = -100, cx = x, cy = y;
    window.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; cur.classList.add('is-on'); }, { passive: true });
    document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
    document.addEventListener('pointerover', (e) => {
      cur.classList.toggle('is-hover', Boolean(e.target.closest && e.target.closest('a, button, summary, .op, [data-tilt]')));
    });
    const mover = () => {
      cx = lerp(cx, x, 0.2); cy = lerp(cy, y, 0.2);
      cur.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
      requestAnimationFrame(mover);
    };
    mover();
  }

  function iniciarFaq() {
    const items = $$('.faq-item');
    items.forEach((d) => d.addEventListener('toggle', () => {
      if (d.open) items.forEach((o) => { if (o !== d) o.open = false; });
    }));
  }

  /* ─────────────── 08 · FORMULARIO → WHATSAPP ─────────────── */
  function iniciarFormulario() {
    const form = $('#form-proyecto');
    if (!form) return;
    const barra = $('[data-wiz-barra]', form);
    const nombre = $('#nombre', form);
    const detalles = $('#detalles', form);
    const campo = nombre.closest('.campo');
    const error = $('#error-nombre', form);
    const nota = $('[data-wiz-nota]', form);
    const valor = (n) => (form.elements[n] && form.elements[n].value) || '';

    const progreso = () => {
      let llenos = 0;
      ['tipo', 'punto', 'servicio'].forEach((n) => { if (valor(n)) llenos++; });
      if (nombre.value.trim()) llenos++;
      if (barra) barra.style.setProperty('--w', (0.06 + (llenos / 4) * 0.94).toFixed(2));
    };
    form.addEventListener('input', progreso);
    form.addEventListener('change', progreso);
    nombre.addEventListener('input', () => { campo.classList.remove('tiene-error'); error.hidden = true; nombre.removeAttribute('aria-invalid'); });
    progreso();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const quien = nombre.value.trim();
      if (!quien) {
        campo.classList.add('tiene-error'); error.hidden = false; nombre.setAttribute('aria-invalid', 'true'); nombre.focus();
        return;
      }
      if (!hayWhatsApp) return;
      const lineas = [`Hola Luis, soy ${quien}.`];
      const tipo = valor('tipo'), punto = valor('punto'), servicio = valor('servicio'), extra = detalles.value.trim();
      lineas.push(tipo ? `Quiero platicar un proyecto: ${tipo.toLowerCase()}.` : 'Quiero platicar un proyecto.');
      if (punto) lineas.push(`Mi punto de partida: ${punto.toLowerCase()}.`);
      if (servicio) lineas.push(`Necesito: ${servicio.toLowerCase()}.`);
      if (extra) lineas.push(`Más detalles: ${extra}`);
      lineas.push('(Mensaje enviado desde tu página web)');
      const url = urlWhatsApp(lineas.join('\n'));
      // Enlace temporal con target _blank: abre WhatsApp en otra pestaña sin que el navegador lo bloquee
      const enlace = document.createElement('a');
      enlace.href = url; enlace.target = '_blank'; enlace.rel = 'noopener';
      document.body.appendChild(enlace); enlace.click(); enlace.remove();
      form.classList.add('enviado');
      if (nota) nota.textContent = '¡Listo! Se abrió WhatsApp con tu mensaje. Solo falta que le des enviar.';
    });
  }

  /* ─────────────── ARRANQUE ─────────────── */
  function arrancar() {
    iniciarWhatsApp();
    prepararTextos();
    iniciarHeroMotor();
    iniciarScroll();
    iniciarMenu();
    iniciarServicios();
    iniciarTilt();
    iniciarImanes();
    iniciarCursor();
    iniciarFaq();
    iniciarFormulario();
    doc.classList.add('js-ready');   // si algo de arriba fallara, el CSS muestra todo solo
    iniciarCargador();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar, { once: true });
  else arrancar();
})();
