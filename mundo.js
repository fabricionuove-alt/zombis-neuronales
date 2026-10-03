// ZOMBOID SIN GRAFICOS v2: un barrio de 64x64 casillas con casas (paredes, puertas, ventanas), sobrevivientes que pelean
// como un jugador de PZ (empujon, pisoton, armas reales, pelear de a 1-2, retroceder en fila, cerrar puertas, rematar en la
// ventana) y zombis que piensan con una red (o con el cerebro vanilla de PZ, para comparar). Las heridas son las de
// BodyDamage.AddRandomDamageFromZombie y la ropa protege como en el juego. Todo lo de PZ esta en REGLAS-PZ.md.
// Paso 0,1 s; el cerebro del zombi piensa cada 2 pasos (5 veces por segundo, como iria en el mod).
import {crearRed} from './red.js';

export const DT = 0.1, LADO = 64, DURACION = 180;
export const SUELO = 0, PARED = 1, PUERTA = 2, VENTANA = 3, INTERIOR = 4;
export const ZOMBI = {nEnt: 34, nAcc: 4};   // acciones: 0 nada, 1 atacar/abalanzarse, 2 golpear puerta/ventana; la 4a salida es gemir (si > 0), aparte
// velocidades (m/s = casillas/s): la PROPORCION zombi/jugador sale del codigo (speedMod), la base es calibrada (REGLAS-PZ.md)
const BASE = 1.6, VEL = {caminar: BASE, correr: 2 * BASE, sigilo: 0.55 * BASE, quieto: 0};
// armas de media/scripts/generated/items/weapon.txt: [nombre, danoMin, danoMax, alcance, Swingtime, critico%, xCritico, KnockdownMod, golpesMax]
const ARMAS = [['BaseballBat', 0.8, 1.1, 1.25, 3, 40, 2, 2, 2], ['Axe', 0.8, 2.0, 1.2, 3, 20, 5, 2, 2], ['Crowbar', 0.6, 1.15, 1.25, 3, 20, 2.5, 1, 3],
  ['KitchenKnife', 0.3, 0.7, 0.9, 2, 25, 4, 0, 1], ['HuntingKnife', 0.6, 1.2, 0.9, 2, 50, 3, 0, 1], ['Machete', 2.0, 3.0, 1.23, 4, 20, 5, 2, 2],
  ['Plank', 0.4, 0.6, 1.3, 4, 30, 2, 2, 2], ['Pan', 0.3, 0.5, 1.1, 3, 30, 2, 1.3, 1]];
// ropa de media/scripts/generated/items/clothing.txt: [defensa rasguno, defensa mordida] por prenda
const ROPA = {campera: [[20, 10], [25, 10], [30, 20], [40, 20], [50, 30], [70, 50]], pantalon: [[5, 0], [10, 0], [20, 10], [30, 20], [40, 20]],
  guantes: [[5, 0], [10, 0], [20, 0], [30, 15], [80, 70]], gorro: [[10, 0], [50, 30], [60, 40]], remera: [[5, 0], [10, 0]]};
// partes del cuerpo en el orden de BodyPartType: 0 mano I, 1 mano D, 2 antebrazo I, 3 antebrazo D, 4 brazo I, 5 brazo D,
// 6 torso alto, 7 torso bajo, 8 cabeza, 9 cuello, 10 ingle, 11-14 piernas, 15-16 pies
const MANO_L = 0, TORSO_BAJO = 7, CABEZA = 8, CUELLO = 9, INGLE = 10, MAX_PARTE = 17;
const RAYOS = [-1.05, -0.52, 0, 0.52, 1.05];

export function azar(s) { return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ang = a => Math.atan2(Math.sin(a), Math.cos(a));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const entre = (r, a, b) => a + r() * (b - a);
const unoDe = (r, l) => l[Math.floor(r() * l.length)];

// ---------- el barrio ----------
function barrio(r) {
  const t = new Uint8Array(LADO * LADO), hp = new Float32Array(LADO * LADO), abierta = new Uint8Array(LADO * LADO), casas = [];
  for (let intento = 0; intento < 200 && casas.length < 6; intento++) {
    const w = 7 + Math.floor(r() * 6), h = 7 + Math.floor(r() * 6), x = 3 + Math.floor(r() * (LADO - w - 6)), y = 3 + Math.floor(r() * (LADO - h - 6));
    if (casas.some(c => x < c.x + c.w + 4 && c.x < x + w + 4 && y < c.y + c.h + 4 && c.y < y + h + 4)) continue;
    const c = {x, y, w, h}; casas.push(c);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) t[j * LADO + i] = (i === x || j === y || i === x + w - 1 || j === y + h - 1) ? PARED : INTERIOR;
    const borde = () => { const lado = Math.floor(r() * 4), k = r();
      if (lado === 0) return [x + 1 + Math.floor(k * (w - 2)), y]; if (lado === 1) return [x + 1 + Math.floor(k * (w - 2)), y + h - 1];
      if (lado === 2) return [x, y + 1 + Math.floor(k * (h - 2))]; return [x + w - 1, y + 1 + Math.floor(k * (h - 2))]; };
    const nP = 1 + Math.floor(r() * 2), nV = 2 + Math.floor(r() * 3);
    for (let k = 0; k < nP; k++) { const [i, j] = borde(); t[j * LADO + i] = PUERTA; hp[j * LADO + i] = 12; }
    for (let k = 0; k < nV; k++) { const [i, j] = borde(); if (t[j * LADO + i] === PARED) { t[j * LADO + i] = VENTANA; hp[j * LADO + i] = 3; } }
  }
  for (let i = 0; i < LADO; i++) { t[i] = t[(LADO - 1) * LADO + i] = t[i * LADO] = t[i * LADO + LADO - 1] = PARED; }
  return {t, hp, abierta, casas};
}
const celda = (m, x, y) => { const i = Math.floor(x), j = Math.floor(y); return (i < 0 || j < 0 || i >= LADO || j >= LADO) ? -1 : j * LADO + i; };
function pasaZombi(m, k) { if (k < 0) return 0; const t = m.t[k];
  if (t === SUELO || t === INTERIOR) return 1; if (t === PUERTA) return (m.hp[k] <= 0 || m.abierta[k]) ? 1 : 0; if (t === VENTANA) return m.hp[k] <= 0 ? 0.35 : 0; return 0; }
function pasaHumano(m, k) { if (k < 0) return 0; const t = m.t[k];
  if (t === SUELO || t === INTERIOR || t === PUERTA) return 1; if (t === VENTANA) return m.hp[k] <= 0 ? 0.4 : 0; return 0; }
function tapaVista(m, k) { const t = m.t[k]; return t === PARED || (t === PUERTA && m.hp[k] > 0 && !m.abierta[k]); }
export function seVe(m, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 0.25);
  for (let s = 1; s < n; s++) { const k = celda(m, x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n); if (k < 0 || tapaVista(m, k)) return false; }
  return true;
}
function moverse(m, a, dx, dy, pasa) {   // (cada eje por separado, asi resbala por las paredes)
  const f = pasa(m, celda(m, a.x, a.y)) || 1, mx = a.x + dx * f, my = a.y + dy * f, mg = 0.3;
  if (pasa(m, celda(m, mx + Math.sign(dx) * mg, a.y))) a.x = mx;
  if (pasa(m, celda(m, a.x, my + Math.sign(dy) * mg))) a.y = my;
}
// campo de distancias (BFS) hacia una casilla; los zombis cuentan puertas y ventanas sanas como pasables (se rompen)
function campo(ep, gx, gy, quien) {
  const clave = quien + (gy * LADO + gx); let c = ep.campos.get(clave); if (c) return c;
  const m = ep.m; c = new Int16Array(LADO * LADO).fill(-1); const cola = new Int32Array(LADO * LADO); let a = 0, b = 0;
  const ok = k => { const t = m.t[k]; if (t === PARED) return false; if (quien === 'h' && t === VENTANA && m.hp[k] > 0) return false; return true; };
  const g = gy * LADO + gx; c[g] = 0; cola[b++] = g;
  while (a < b) { const k = cola[a++], i = k % LADO, j = (k - i) / LADO;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= LADO || jj >= LADO) continue; const kk = jj * LADO + ii; if (c[kk] < 0 && ok(kk)) { c[kk] = c[k] + 1; cola[b++] = kk; } } }
  if (ep.campos.size > 400) ep.campos.clear(); ep.campos.set(clave, c); return c;
}
function rumbo(ep, a, gx, gy, quien) {   // hacia donde queda el proximo paso del camino (angulo absoluto) o null
  const c = campo(ep, Math.floor(gx), Math.floor(gy), quien), k = celda(ep.m, a.x, a.y); if (k < 0 || c[k] < 0) return null;
  if (c[k] <= 1) return Math.atan2(gy - a.y, gx - a.x);
  const i = k % LADO, j = (k - i) / LADO; let mejor = c[k], bi = 0, bj = 0;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const kk = (j + dj) * LADO + i + di; if (c[kk] >= 0 && c[kk] < mejor && (di === 0 || dj === 0 || (c[j * LADO + i + di] >= 0 && c[(j + dj) * LADO + i] >= 0))) { mejor = c[kk]; bi = di; bj = dj; } }
  return (bi || bj) ? Math.atan2(j + bj + 0.5 - a.y, i + bi + 0.5 - a.x) : null;
}

// ---------- vista y oido de PZ ----------
function radioVision(ep) { return Math.min(20, Math.max(10, 20 - Math.max(ep.clima.niebla * 7, ep.clima.lluvia * 2.5 + ep.clima.oscuridad * 5))); }
function luzEn(ep, x, y) { const k = celda(ep.m, x, y), base = 1 - ep.clima.oscuridad * 0.9; return ep.m.t[k] === INTERIOR ? base * 0.6 : base; }
// chance de verte por segundo: cono (escalones de spottedNew), luz, movimiento, distancia. Calibrada, ver REGLAS-PZ.md
function chanceVer(ep, z, h, d, r) {
  const dot = (Math.cos(z.a) * (h.x - z.x) + Math.sin(z.a) * (h.y - z.y)) / (d || 1);
  let cono = dot < -0.4 ? 0 : dot < -0.2 ? 0.125 : dot < 0 ? 0.25 : dot < 0.2 ? 0.5 : dot <= 0.4 ? 2 : dot <= 0.6 ? 8 : dot <= 0.8 ? 16 : 32;
  if (d < 1.5) cono = Math.max(cono, 8);
  const mov = h.modo === 'correr' ? 3 : h.modo === 'sigilo' ? 0.35 : h.modo === 'quieto' ? 0.5 : 1;
  return 0.15 * cono * Math.max(0.1, luzEn(ep, h.x, h.y)) * mov * Math.max(0.05, 1 - d / r);
}
function sonar(ep, x, y, r, tipo, quien) { ep.sonidos.push({x, y, r, tipo, quien, t: ep.t}); }

// ---------- el episodio ----------
export function crearEpisodio(semilla, genomas, opc = {}) {
  const r = azar(semilla), m = barrio(r), nz = opc.nz || 12, nh = opc.nh || 2;
  const clima = {oscuridad: r() < 0.4 ? 0.6 + r() * 0.4 : r() * 0.3, niebla: r() < 0.2 ? r() : 0, lluvia: r() < 0.3 ? r() : 0};
  const libre = (dentro) => { for (;;) { const x = 2 + r() * (LADO - 4), y = 2 + r() * (LADO - 4), t = m.t[celda(m, x, y)]; if (dentro ? t === INTERIOR : t === SUELO) return {x, y}; } };
  const humanos = [], caracteres = ['peleador', 'cauto', 'armado', 'corredor'];
  for (let i = 0; i < nh; i++) { const p = libre(r() < 0.5), a = unoDe(r, ARMAS);
    // ropa: defensa [rasguno, mordida] por parte; las capas se suman (getBodyPartClothingDefense), tope 100
    const def = Array.from({length: MAX_PARTE}, () => [0, 0]), poner = (partes, d) => partes.forEach(k => { def[k][0] = Math.min(100, def[k][0] + d[0]); def[k][1] = Math.min(100, def[k][1] + d[1]); });
    poner([2, 3, 4, 5, 6, 7], unoDe(r, ROPA.remera)); if (r() < 0.6) poner([2, 3, 4, 5, 6, 7], unoDe(r, ROPA.campera));
    poner([10, 11, 12, 13, 14], unoDe(r, ROPA.pantalon)); if (r() < 0.25) poner([0, 1], unoDe(r, ROPA.guantes)); if (r() < 0.3) poner([8], unoDe(r, ROPA.gorro));
    humanos.push({x: p.x, y: p.y, a: r() * 6.283, vida: 100, vivo: true, sano: 1, modo: 'caminar', aguante: 1, caracter: caracteres[Math.floor(r() * 4)],
      arma: {nombre: a[0], min: a[1], max: a[2], alcance: a[3], swing: a[4] / 3, crit: a[5] / 100, xcrit: a[6], derribo: a[7], golpes: a[8]},
      def, combate: Math.floor(r() * 6), balas: 0, golpe: 0, golpeDur: 0, golpeHecho: false, cdEmpujon: 0, cdTiro: 0, meta: null, saqueo: 0, cerrar: -1,
      heridas: {rasguno: 0, laceracion: 0, mordida: 0}, arrastrado: false}); }
  humanos.forEach(h => { if (h.caracter === 'armado') h.balas = 8; });
  const zombis = [];
  for (let i = 0; i < nz; i++) { let p;
    if (opc.cerca) {   // (MODO ATAQUE: cada zombi aparece a 6-14 casillas de un sobreviviente, en piso libre)
      const h = humanos[i % nh]; for (let k = 0; k < 500; k++) { const a = r() * 6.283, d = 6 + r() * 8, q = {x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d}, kk = celda(m, q.x, q.y);
        if (kk >= 0 && (m.t[kk] === SUELO || m.t[kk] === INTERIOR)) { p = q; break; } }
      if (!p) p = libre(false); }
    else do { p = libre(false); } while (humanos.some(h => Math.hypot(h.x - p.x, h.y - p.y) < 16));
    const g = Array.isArray(genomas) ? genomas[i % genomas.length] : genomas;
    zombis.push({x: p.x, y: p.y, a: r() * 6.283, vida: entre(r, 1.8, 2.1), vivo: true, vel0: entre(r, 0.55, 0.79) * BASE,   // (doShambler: speedMod 0.55 + azar 0..0.24)
      red: g ? crearRed(g, ZOMBI.nEnt, ZOMBI.nAcc) : null, especie: Array.isArray(genomas) ? i % genomas.length : 0,
      ve: -1, mem: null, oido: null, cdAt: 0, amago: 0, presa: -1, cdGem: 0, cdGolpe: 0, cdLunge: 0, lunge: 0, tambaleo: 0, piso: 0, enVentana: false,
      giro: 0, vel: 0, acc: 0, gem: false, deambula: r() * 6.283, infecto: 0, gemidos: 0, ticksMeta: 0, ticksLento: 0, ticks: 0}); }
  return {r, m, clima, humanos, zombis, sonidos: [], campos: new Map(), t: 0, paso: 0, muertes: 0, arrastres: 0, mordidas: 0, heridas: 0, agarres: 0, pegado: 0, zombisMuertos: 0, lados: [0, 0, 0], nAtac: [0, 0, 0], primera: -1,
    fin: false, vanilla: !genomas, rv: 0, grabar: opc.grabar || null, tutor: opc.tutor || null, base: opc.base || null, duracion: opc.duracion || DURACION, caza: !!opc.cerca};
}

function percibir(ep, z) {
  const rv = ep.rv; let mejor = -1, md = 1e9;
  for (let i = 0; i < ep.humanos.length; i++) { const h = ep.humanos[i]; if (!h.vivo) continue; const d = dist(h, z); if (d > rv) continue;
    const yaLoVe = z.ve === i; if (!seVe(ep.m, z.x, z.y, h.x, h.y)) continue;
    if (yaLoVe || ep.r() < 1 - Math.exp(-chanceVer(ep, z, h, d, rv) * DT)) { if (d < md) { md = d; mejor = i; } } }
  z.ve = mejor; if (mejor >= 0) z.mem = {x: ep.humanos[mejor].x, y: ep.humanos[mejor].y, t: ep.t};
  for (const s of ep.sonidos) { if (!(ep.t - s.t > 1e-6 && ep.t - s.t < DT + 1e-6) || s.quien === z) continue;   /* (los sonidos del paso anterior: asi todos oyen todo) */
    const d = Math.hypot(s.x - z.x, s.y - z.y); if (d > s.r) continue;
    const fuerza = 1 - d / s.r; if (z.oido && z.oido.f * Math.max(0, 1 - (ep.t - z.oido.t) / 10) > fuerza) continue;
    const err = (2 + ep.clima.lluvia * 3) * (d / s.r) + (d / s.r) * 6 * ep.r();   // (HEARING_UNSEEN_OFFSET 2..10, 5 con lluvia fuerte)
    const ea = ep.r() * 6.283; z.oido = {x: s.x + Math.cos(ea) * err, y: s.y + Math.sin(ea) * err, f: fuerza, tipo: s.tipo, t: ep.t}; }
}
function frente(ep, z) { return celda(ep.m, z.x + Math.cos(z.a) * 0.8, z.y + Math.sin(z.a) * 0.8); }
function meta(ep, z) {
  if (z.ve >= 0) return {x: ep.humanos[z.ve].x, y: ep.humanos[z.ve].y, tipo: 1};
  if (z.mem && ep.t - z.mem.t < 30) return {x: z.mem.x, y: z.mem.y, tipo: 2};
  if (z.oido && ep.t - z.oido.t < 15) return {x: z.oido.x, y: z.oido.y, tipo: 3};
  return null;
}
function atacantes(ep, h) { const hi = ep.humanos.indexOf(h); let n = 0;
  for (const o of ep.zombis) if (o.vivo && !(o.piso > 0) && o.presa === hi && (o.amago > 0 || o.cdAt > 0) && dist(o, h) < 1.4) n++; return n; }
const x = new Float32Array(ZOMBI.nEnt);
function entradas(ep, z) {
  const rel = (px, py) => { const a = Math.atan2(py - z.y, px - z.x) - z.a; return [Math.sin(a), Math.cos(a), Math.min(1, Math.hypot(px - z.x, py - z.y) / 20)]; };
  x.fill(0);
  if (z.ve >= 0) { const h = ep.humanos[z.ve]; x[0] = 1; [x[1], x[2], x[3]] = rel(h.x, h.y); x[4] = h.modo === 'correr' ? 1 : 0;
    x[5] = (Math.cos(h.a) * (z.x - h.x) + Math.sin(h.a) * (z.y - h.y)) / (dist(z, h) || 1);   // (1 = me mira de frente, -1 = le veo la espalda)
    x[6] = h.golpe > 0 ? 1 : 0; let n = 0; for (const o of ep.zombis) if (o !== z && o.vivo && dist(o, h) < 2) n++; x[7] = Math.min(1, n / 3); }
  if (z.mem && ep.t - z.mem.t < 30) { x[8] = 1; [x[9], x[10], x[11]] = rel(z.mem.x, z.mem.y); x[12] = (ep.t - z.mem.t) / 30; }
  if (z.oido && ep.t - z.oido.t < 15) { x[13] = z.oido.f * (1 - (ep.t - z.oido.t) / 15); [x[14], x[15]] = rel(z.oido.x, z.oido.y); x[16] = z.oido.tipo; }
  const mt = meta(ep, z); if (mt) { const rb = rumbo(ep, z, mt.x, mt.y, 'z'); if (rb !== null) { x[17] = Math.sin(rb - z.a); x[18] = Math.cos(rb - z.a); } }
  let i = 19; for (const da of RAYOS) { let d = 0; for (; d < 6; d += 0.5) { const k = celda(ep.m, z.x + Math.cos(z.a + da) * d, z.y + Math.sin(z.a + da) * d); if (!pasaZombi(ep.m, k)) break; } x[i++] = d / 6; }
  const kf = frente(ep, z), tf = kf >= 0 ? ep.m.t[kf] : PARED; x[24] = (tf === PUERTA && ep.m.hp[kf] > 0 && !ep.m.abierta[kf]) ? 1 : 0; x[25] = (tf === VENTANA && ep.m.hp[kf] > 0) ? 1 : 0;
  let n = 0, cx = 0, cy = 0; for (const o of ep.zombis) if (o !== z && o.vivo) { const d = dist(o, z); if (d < 8) { n++; cx += o.x; cy += o.y; } }
  x[26] = Math.min(1, n / 5); if (n) { const [s, c] = rel(cx / n, cy / n); x[27] = s; x[28] = c; }
  x[29] = z.vida / 2; x[30] = ep.m.t[celda(ep.m, z.x, z.y)] === INTERIOR ? 1 : 0; x[31] = luzEn(ep, z.x, z.y);
  x[32] = z.cdAt <= 0 && z.amago <= 0 ? 1 : 0; x[33] = z.piso > 0 || z.tambaleo > 0 ? 1 : 0;
  return x;
}
// el cerebro de PZ hoy: ve -> persigue y ataca; si no, va a donde lo vio; si no, al sonido; si no, deambula. Golpea si lo tapa algo.
function vanilla(ep, z) {
  const mt = meta(ep, z); let giro = 0, vel = 0.3, acc = 0;
  if (mt) { const rb = rumbo(ep, z, mt.x, mt.y, 'z') ?? Math.atan2(mt.y - z.y, mt.x - z.x); giro = Math.max(-1, Math.min(1, ang(rb - z.a) * 2)); vel = 1;
    const kf = frente(ep, z); if (kf >= 0 && ((ep.m.t[kf] === PUERTA && ep.m.hp[kf] > 0 && !ep.m.abierta[kf]) || (ep.m.t[kf] === VENTANA && ep.m.hp[kf] > 0))) acc = 2;
    if (z.ve >= 0 && dist(ep.humanos[z.ve], z) < 3) acc = 1; }
  else { if (ep.r() < 0.01) z.deambula = ep.r() * 6.283; giro = Math.max(-1, Math.min(1, ang(z.deambula - z.a))); vel = 0.25; }
  return {giro, vel, accion: acc};
}

// LA HERIDA, como BodyDamage.AddRandomDamageFromZombie (B42). n = zombis atacando a la vez (getSurroundingAttackingZombies)
function herida(ep, z, h) {
  const r = ep.r, n = Math.max(1, atacantes(ep, h)); ep.agarres++;
  let c5 = 15 + h.combate - (n - 1) * 10, c6 = 85 - (n - 1) * 30, c7 = 65 - (n - 1) * 15;   // (c5: sin herida, c6: mordida, c7: laceracion)
  if (n >= 3) { ep.nAtac[2]++; h.vivo = false; h.sano = 0; h.arrastrado = true; ep.muertes++; ep.arrastres++; return; }   // (te tiran al piso: EndDeath, fuerza normal = 3)
  const dot = (Math.cos(h.a) * (z.x - h.x) + Math.sin(h.a) * (z.y - h.y)) / (dist(z, h) || 1), atras = dot < -0.4, costado = !atras && dot < 0.4;
  ep.lados[atras ? 2 : costado ? 1 : 0]++; ep.nAtac[Math.min(3, n) - 1]++;   // (para describir: de que lado y cuantos a la vez)
  if (atras) { c5 -= 15; c6 -= 25; c7 -= 35; if (n > 2) { c6 -= 15; c7 -= 15; } }
  if (costado) { c5 -= 30; c6 -= 7; c7 -= 27; }
  if (r() * 100 <= c5) return;   // (el agarre no rompio la piel)
  let parte = r() < 0.1 ? MANO_L + Math.floor(r() * (INGLE + 1)) : MANO_L + Math.floor(r() * (CUELLO + 1));
  if (atras && r() * 100 < 10 * n + 5 + (costado ? 2 : 0)) parte = CUELLO;
  if ((parte === CABEZA || parte === CUELLO) && r() * 100 > (atras ? 90 : costado ? 80 : 70)) { do { parte = Math.floor(r() * (TORSO_BAJO + 1)); } while (parte === CABEZA || parte === CUELLO); }
  let tipo = 'rasguno'; if (r() * 100 > c7) tipo = 'laceracion'; if (r() * 100 > c6) tipo = 'mordida';
  if (r() * 100 < h.def[parte][tipo === 'mordida' ? 1 : 0]) return;   // (la ropa lo freno: solo un agujero)
  h.heridas[tipo]++; ep.heridas++; if (ep.primera < 0) ep.primera = ep.t; if (tipo === 'mordida') ep.mordidas++;
  h.vida -= r() * (10 + Math.floor(r() * 10));
  const p = tipo === 'mordida' ? 1 : tipo === 'laceracion' ? 0.25 : 0.07;   // (chance de contagio: wiki de PZ, Knox Infection)
  const antes = h.sano; h.sano *= 1 - p; z.infecto += antes - h.sano;
  if (h.vida <= 0) { h.vivo = false; ep.muertes++; }
}

function pasoZombi(ep, z) {
  if (!z.vivo) return; percibir(ep, z);
  z.cdAt -= DT; z.cdGem -= DT; z.cdGolpe -= DT; z.cdLunge -= DT; z.lunge -= DT; z.tambaleo -= DT;
  if (z.piso > 0) { z.piso -= DT; return; }   // (en el piso: no hace nada hasta levantarse)
  if (ep.paso % 2 === 0 && ep.tutor) {   // (un especimen de la TUTORA: reglas escritas a mano; se graban para pasarlas a una red)
    const v = vanilla(ep, z), o = ep.tutor(ep, z, v);
    if (ep.grabar && ep.r() < ep.grabar.prob) ep.grabar.datos.push([Float32Array.from(entradas(ep, z)), o.giro, o.vel, o.accion, o.gem ? 1 : 0, v.giro, v.vel, v.accion]);
    z.giro = o.giro; z.vel = o.vel; z.acc = o.accion; z.gem = !!o.gem; z.ticks++; if (meta(ep, z)) { z.ticksMeta++; if (z.vel < 0.35) z.ticksLento++; } }
  else if (ep.paso % 2 === 0) { const o = z.red ? z.red.paso(entradas(ep, z)) : ep.base ? ep.base(ep, z, vanilla(ep, z)) : vanilla(ep, z);
    if (ep.grabar && ep.r() < ep.grabar.prob) ep.grabar.datos.push([Float32Array.from(entradas(ep, z)), o.giro, o.vel, o.accion]);
    z.giro = o.giro; z.vel = o.vel; z.acc = o.accion; z.gem = !!o.gem;
    if (o.o) {   // POLITICA RESIDUAL (Silver et al. 2018): la red no reemplaza al zombi de PZ, le suma correcciones. Red en cero = vanilla exacto.
      const v = ep.base ? ep.base(ep, z, vanilla(ep, z)) : vanilla(ep, z), c = o.o; z.giro = Math.max(-1, Math.min(1, v.giro + Math.tanh(c[0]))); z.vel = Math.max(0, Math.min(1, v.vel + 2 / (1 + Math.exp(-c[1])) - 1));
      let a = 0, mejor = -1e9; for (let k = 0; k < 3; k++) { const s = c[2 + k] + (k === v.accion ? 2 : 0); if (s > mejor) { mejor = s; a = k; } } z.acc = a;
      z.gem = v.gem ? c[5] > -4 : c[5] > 0; }   // (gemir es una salida aparte; si la base gime, la red tiene que empujar fuerte para callarlo)
    z.ticks++; if (meta(ep, z)) { z.ticksMeta++; if (z.vel < 0.35) z.ticksLento++; } }
  if (z.tambaleo > 0) { z.amago = 0; return; }   // (le pegaron o lo empujaron: tambalea y pierde el ataque)
  z.a = ang(z.a + z.giro * 4 * DT);
  if (z.amago > 0) { z.amago -= DT; const h = ep.humanos[z.presa];   // (el ataque tarda 0,6 s: si en ese tiempo le pegan, no llega)
    if (z.amago <= 0 && h && h.vivo && dist(h, z) < 1.1) { z.cdAt = 1; herida(ep, z, h); } return; }
  const h = z.ve >= 0 ? ep.humanos[z.ve] : null, dh = h ? dist(h, z) : 99;
  if (dh < 1.5) ep.pegado += DT;   // (segundos de zombi pegado a su presa: credito parcial para entrenar)
  if (z.acc === 1 && h) {
    const dot = (Math.cos(z.a) * (h.x - z.x) + Math.sin(z.a) * (h.y - z.y)) / (dh || 1);
    if (dh < 0.9 && z.cdAt <= 0 && dot > 0.5) { z.amago = 0.6; z.presa = z.ve; return; }
    if (dh < 3 && z.cdLunge <= 0 && dot > 0.7) { z.lunge = 0.8; z.cdLunge = 3; }
  }
  if (z.acc === 2 && z.cdGolpe <= 0) { const kf = frente(ep, z), t = kf >= 0 ? ep.m.t[kf] : 0;
    if ((t === PUERTA || t === VENTANA) && ep.m.hp[kf] > 0 && !ep.m.abierta[kf]) { z.cdGolpe = 1; ep.m.hp[kf] -= 1; sonar(ep, z.x, z.y, 15, 2, z); if (ep.m.hp[kf] <= 0) ep.campos.clear(); } }
  if (z.gem && z.cdGem <= 0) { z.cdGem = 4; z.gemidos++; sonar(ep, z.x, z.y, 14, -1, z); }
  const v = z.vel0 * z.vel * (z.lunge > 0 ? 2.2 : 1) * DT;
  moverse(ep.m, z, Math.cos(z.a) * v, Math.sin(z.a) * v, pasaZombi);
  const enV = ep.m.t[celda(ep.m, z.x, z.y)] === VENTANA;   // (al pasar por una ventana el zombi cae del otro lado)
  if (z.enVentana && !enV) z.piso = 2; z.enVentana = enV;
}
function golpearZombi(ep, z, dano, derribo) {
  z.vida -= dano; if (z.vida <= 0) { z.vivo = false; ep.zombisMuertos++; return; }
  z.tambaleo = 0.7; z.amago = 0; if (ep.r() < derribo) z.piso = 2.5;
}

// ---------- el sobreviviente: pelea como un jugador de PZ ----------
function pasoHumano(ep, h) {
  if (!h.vivo) return; h.cdEmpujon -= DT; h.cdTiro -= DT;
  const ar = h.arma, cansado = h.aguante < 0.25;
  if (h.golpe > 0) {   // (el golpe en curso: pega al 60% del swing, a los que esten en el arco y al alcance)
    h.golpe -= DT; if (!h.golpeHecho && h.golpe < h.golpeDur * 0.4) { h.golpeHecho = true; let n = 0;
      for (const z of ep.zombis) { if (!z.vivo || n >= ar.golpes) continue; const d = dist(z, h); if (d > ar.alcance + 0.2) continue;
        const dot = (Math.cos(h.a) * (z.x - h.x) + Math.sin(h.a) * (z.y - h.y)) / (d || 1); if (dot < 0.6 && !(z.piso > 0 && d < 1)) continue;
        let dano = entre(ep.r, ar.min, ar.max); if (ep.r() < ar.crit) dano *= ar.xcrit; golpearZombi(ep, z, dano, 0.12 * ar.derribo); n++; } }
    return; }
  const vista = 15 * (1 - ep.clima.oscuridad * 0.5) * (1 - ep.clima.niebla * 0.4);
  const ven = ep.zombis.filter(z => { if (!z.vivo) return false; const d = dist(z, h); if (d < 3) return true; if (d > vista) return false;
    const dot = (Math.cos(h.a) * (z.x - h.x) + Math.sin(h.a) * (z.y - h.y)) / d; return dot > -0.2 && seVe(ep.m, h.x, h.y, z.x, z.y); });   // (vision de ~160 grados + los que oye pegados)
  const parados = ven.filter(z => !(z.piso > 0)), cercaNo = parados.filter(z => dist(z, h) < 4).length;
  let p1 = null, d1 = 1e9; for (const z of parados) { const d = dist(z, h); if (d < d1) { d1 = d; p1 = z; } }
  let piso = null; for (const z of ven) if (z.piso > 0 && dist(z, h) < 1.1) piso = z;
  const limite = h.caracter === 'peleador' ? 3 : h.caracter === 'cauto' ? 1 : 2;
  let dir = null; h.modo = h.caracter === 'cauto' ? 'sigilo' : 'caminar';
  const mirar = z => { h.a = Math.atan2(z.y - h.y, z.x - h.x); };
  if (h.balas > 0 && p1 && d1 < 10 && d1 > 2 && parados.length >= 3 && h.cdTiro <= 0) {   // (armado: tira cuando vienen varios; el tiro se oye lejos)
    mirar(p1); h.cdTiro = 1; h.balas--; sonar(ep, h.x, h.y, 50, 1, h); h.modo = 'quieto'; if (ep.r() < 0.5) golpearZombi(ep, p1, entre(ep.r, 0.6, 1.0) * (ep.r() < 0.2 ? 4 : 1), 0.3); }
  else if (piso && (!p1 || d1 > 1.6)) { mirar(piso); h.modo = 'quieto'; h.golpeDur = 0.5; h.golpe = 0.5; h.golpeHecho = true; golpearZombi(ep, piso, entre(ep.r, 0.5, 1.0), 0); }   // (pisoton al que esta en el piso)
  else if (p1 && d1 < 0.8 && h.cdEmpujon <= 0) {   // (empujon: lo tambalea y a veces lo tira; no lastima)
    mirar(p1); h.modo = 'quieto'; h.cdEmpujon = 0.8; h.golpeDur = 0.4; h.golpe = 0.4; h.golpeHecho = true; h.aguante = Math.max(0, h.aguante - 0.02);
    for (const z of parados) { const d = dist(z, h); if (d < 1.2 && (Math.cos(h.a) * (z.x - h.x) + Math.sin(h.a) * (z.y - h.y)) / (d || 1) > 0.5) { z.tambaleo = 1; z.amago = 0; if (ep.r() < 0.3) z.piso = 2.5; } } }
  else if (p1 && cercaNo <= limite && d1 < ar.alcance + 0.1 && !(cansado && cercaNo > 1)) {   // (le pega al primero)
    mirar(p1); h.modo = 'quieto'; h.golpeDur = ar.swing * (cansado ? 1.5 : 1); h.golpe = h.golpeDur; h.golpeHecho = false; h.aguante = Math.max(0, h.aguante - 0.03 * ar.swing); sonar(ep, h.x, h.y, 5, 1, h); }
  else if (p1 && cercaNo <= limite && d1 < 4 && !cansado) { dir = Math.atan2(p1.y - h.y, p1.x - h.x); }   // (se acerca a pegarle)
  else if (p1 && d1 < 9) {   // (son muchos o esta cansado: retrocede en fila, mirando cual se separa)
    let mejor = -1e9; for (let k = 0; k < 16; k++) { const a = k * 0.3927, px = h.x + Math.cos(a) * 1.5, py = h.y + Math.sin(a) * 1.5; if (!pasaHumano(ep.m, celda(ep.m, px, py))) continue;
      let s = 1e9; for (const z of parados) s = Math.min(s, Math.hypot(z.x - px, z.y - py)); s += 0.3 * Math.cos(a - h.a); if (s > mejor) { mejor = s; dir = a; } }
    h.modo = h.aguante > 0.3 && (h.caracter === 'corredor' || d1 < 3) ? 'correr' : 'caminar'; h.meta = null; }
  else {   // (sin amenazas cerca: saquea casa por casa)
    if (!h.meta) { const c = unoDe(ep.r, ep.m.casas); h.meta = {x: c.x + 1 + Math.floor(ep.r() * (c.w - 2)) + 0.5, y: c.y + 1 + Math.floor(ep.r() * (c.h - 2)) + 0.5}; h.saqueo = 15 + ep.r() * 25; }
    if (Math.hypot(h.meta.x - h.x, h.meta.y - h.y) < 0.8) { h.modo = 'quieto'; h.saqueo -= DT; if (h.saqueo <= 0) h.meta = null; }
    else { dir = rumbo(ep, h, h.meta.x, h.meta.y, 'h') ?? Math.atan2(h.meta.y - h.y, h.meta.x - h.x); if (parados.length) h.modo = 'sigilo'; }
  }
  if (h.modo === 'correr') h.aguante = Math.max(0, h.aguante - DT / 25); else h.aguante = Math.min(1, h.aguante + DT / (h.modo === 'quieto' ? 30 : 50));
  if (dir !== null) { h.a = dir; const v = VEL[h.modo] * DT, k0 = celda(ep.m, h.x, h.y); moverse(ep.m, h, Math.cos(dir) * v, Math.sin(dir) * v, pasaHumano);
    const k1 = celda(ep.m, h.x, h.y);
    if (ep.m.t[k1] === PUERTA && ep.m.hp[k1] > 0) { ep.m.abierta[k1] = 1; h.cerrar = k1; }
    if (h.cerrar >= 0 && k1 !== h.cerrar && h.caracter !== 'corredor') { ep.m.abierta[h.cerrar] = 0; h.cerrar = -1; }   // (cierra la puerta al pasar)
    if (k0 !== k1 && h.modo === 'correr' && ep.paso % 3 === 0) sonar(ep, h.x, h.y, 10, 1, h);
    else if (k0 !== k1 && h.modo === 'caminar' && ep.paso % 5 === 0) sonar(ep, h.x, h.y, 3, 1, h); }
}

export function paso(ep) {
  if (ep.fin) return; ep.rv = radioVision(ep);
  for (const h of ep.humanos) pasoHumano(ep, h);
  for (const z of ep.zombis) pasoZombi(ep, z);
  for (let i = 0; i < ep.zombis.length; i++) { const a = ep.zombis[i]; if (!a.vivo) continue;   // (se empujan entre ellos)
    for (let j = i + 1; j < ep.zombis.length; j++) { const b = ep.zombis[j]; if (!b.vivo) continue; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d < 0.5 && d > 1e-4) { const e = (0.5 - d) / 2 / d; moverse(ep.m, a, -dx * e, -dy * e, pasaZombi); moverse(ep.m, b, dx * e, dy * e, pasaZombi); } } }
  ep.sonidos = ep.sonidos.filter(s => ep.t - s.t < 1.5);
  ep.t = +(ep.t + DT).toFixed(3); ep.paso++;
  if (ep.t >= ep.duracion || ep.humanos.every(h => !h.vivo || (ep.caza && h.sano < 0.001)) || ep.zombis.every(z => !z.vivo)) ep.fin = true;   // (modo ataque: termina cuando todos estan cazados)
}

// corre un episodio entero. LA CAZA se mide como en PZ: la chance de que cada sobreviviente termine infectado
// (mordida 100%, laceracion 25%, rasguno 7%; que te tiren al piso = 100%). apt = suma sobre los sobrevivientes (0..2).
export function vivir(genomas, semilla, opc) {
  const ep = crearEpisodio(semilla, genomas, opc); while (!ep.fin) paso(ep);
  const zs = ep.zombis, tm = zs.reduce((s, z) => s + z.ticksMeta, 0);
  const apt = ep.humanos.reduce((s, h) => s + (1 - h.sano), 0);
  // aptE = la que se usa para ENTRENAR: la infeccion mas credito parcial por atacar (agarres, heridas y segundos pegado).
  // La PRUEBA contra el vanilla usa solo apt (infeccion real).
  return {apt, aptE: apt + 0.02 * ep.agarres + 0.05 * ep.heridas + 0.005 * ep.pegado, pegado: ep.pegado, agarres: ep.agarres, muertes: ep.muertes, arrastres: ep.arrastres, mordidas: ep.mordidas, heridas: ep.heridas,
    zombisMuertos: ep.zombisMuertos, gemir: Math.min(1, zs.reduce((s, z) => s + z.gemidos, 0) / zs.length / (ep.t / 60) / 6),
    paciencia: tm ? zs.reduce((s, z) => s + z.ticksLento, 0) / tm : 0, t: ep.t};
}

// para las reglas de la tutora (tutor/reglas.js)
export const util = {dist, ang, meta, rumbo, frente, atacantes};
