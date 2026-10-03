// LA SEMILLA: la red aprende a hacer lo mismo que el zombi de PZ hoy (aprendizaje supervisado sobre lo que hace el
// vanilla en 200 barrios). Asi la evolucion arranca de un zombi que ya caza, no de uno que da vueltas al azar.
// Se entrena sin recurrencia (h anterior = 0) y Wh queda en cero: la memoria la agrega despues la evolucion.
// Uso: node imitar.mjs  -> semilla.json
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {crearEpisodio, paso, vivir, ZOMBI} from './mundo.js';
import {nPesos, OCULTAS} from './red.js';
const aqui = path.dirname(fileURLToPath(import.meta.url)), NE = ZOMBI.nEnt, NS = 2 + ZOMBI.nAcc, H = OCULTAS, N = nPesos(NE, ZOMBI.nAcc);
const iWh = NE * H, iB = iWh + H * H, iWo = iB + H, iBo = iWo + H * NS;

const grabar = {prob: 0.15, datos: []};
for (let s = 1; s <= 200; s++) { const ep = crearEpisodio(500000 + s, null, {grabar}); while (!ep.fin) paso(ep); }
const D = grabar.datos, cuenta = [0, 0, 0, 0]; D.forEach(d => cuenta[d[3]]++);
const pesoClase = cuenta.map(c => c ? Math.min(20, Math.sqrt(D.length / 4 / c)) : 0);
console.log('ejemplos', D.length, 'acciones', cuenta.join('/'), 'peso', pesoClase.map(p => p.toFixed(2)).join('/'));

let s0 = 3; const u = () => { s0 = (Math.imul(s0, 1664525) + 1013904223) >>> 0; return (s0 + 1) / 4294967297; };
const w = new Float32Array(N); for (let i = 0; i < N; i++) w[i] = (u() - 0.5) * 0.3; for (let i = iWh; i < iB; i++) w[i] = 0;
const gr = new Float32Array(N), m = new Float32Array(N), v = new Float32Array(N); let t = 0;
const h = new Float32Array(H), o = new Float32Array(NS), dh = new Float32Array(H), p = new Float32Array(4);
for (let epoca = 0; epoca < 25; epoca++) {
  for (let i = D.length - 1; i > 0; i--) { const j = Math.floor(u() * (i + 1)); [D[i], D[j]] = [D[j], D[i]]; }
  let perd = 0, bien = 0;
  for (let b0 = 0; b0 < D.length; b0 += 256) {
    gr.fill(0); const nb = Math.min(256, D.length - b0);
    for (let q = b0; q < b0 + nb; q++) { const [x, giro, vel, acc] = D[q];
      for (let j = 0; j < H; j++) { let s = w[iB + j]; for (let i = 0; i < NE; i++) s += w[j * NE + i] * x[i]; h[j] = Math.tanh(s); }
      for (let k = 0; k < NS; k++) { let s = w[iBo + k]; for (let j = 0; j < H; j++) s += w[iWo + k * H + j] * h[j]; o[k] = s; }
      const do_ = new Float32Array(NS);
      const tg = Math.tanh(o[0]); do_[0] = 2 * (tg - giro) * (1 - tg * tg); perd += (tg - giro) ** 2;
      const sv = 1 / (1 + Math.exp(-o[1])); do_[1] = 2 * (sv - vel) * sv * (1 - sv); perd += (sv - vel) ** 2;
      let mx = -1e9; for (let k = 0; k < 4; k++) mx = Math.max(mx, o[2 + k]); let z = 0; for (let k = 0; k < 4; k++) { p[k] = Math.exp(o[2 + k] - mx); z += p[k]; }
      let am = 0; for (let k = 0; k < 4; k++) { p[k] /= z; if (p[k] > p[am]) am = k; do_[2 + k] = pesoClase[acc] * (p[k] - (k === acc ? 1 : 0)); } perd -= Math.log(p[acc] + 1e-9); if (am === acc) bien++;
      dh.fill(0);
      for (let k = 0; k < NS; k++) { gr[iBo + k] += do_[k]; for (let j = 0; j < H; j++) { gr[iWo + k * H + j] += do_[k] * h[j]; dh[j] += do_[k] * w[iWo + k * H + j]; } }
      for (let j = 0; j < H; j++) { const ds = dh[j] * (1 - h[j] * h[j]); gr[iB + j] += ds; for (let i = 0; i < NE; i++) gr[j * NE + i] += ds * x[i]; }
    }
    t++; for (let i = 0; i < N; i++) { if (i >= iWh && i < iB) continue; const g = gr[i] / nb; m[i] = 0.9 * m[i] + 0.1 * g; v[i] = 0.999 * v[i] + 0.001 * g * g; w[i] -= 0.003 * (m[i] / (1 - 0.9 ** t)) / (Math.sqrt(v[i] / (1 - 0.999 ** t)) + 1e-8); }
  }
  console.log('epoca', epoca, 'perdida', (perd / D.length).toFixed(4), 'accion acertada', (bien / D.length * 100).toFixed(1) + '%');
}
for (let k = 2; k < NS; k++) { for (let j = 0; j < H; j++) w[iWo + k * H + j] *= 0.1; w[iBo + k] *= 0.1; }   // (salidas de accion x0,1: misma conducta, pero las mutaciones ahora pesan)
w[iBo + 5] = -2;   // (la semilla no gime: el vanilla nunca gime)
const PRUEBA = Array.from({length: 24}, (_, i) => 90001 + i), pr = (g) => { const r = PRUEBA.map(s => vivir(g, s)); return [r.reduce((a, x) => a + x.apt, 0) / r.length, r.reduce((a, x) => a + x.muertes, 0) / r.length]; };
const [va, vm] = pr(null), [ia, im] = pr(w);
console.log(`PRUEBA (24 barrios nuevos) infeccion esperada / muertes: vanilla ${va.toFixed(2)}/${vm.toFixed(2)}  imitador ${ia.toFixed(2)}/${im.toFixed(2)}`);
fs.writeFileSync(path.join(aqui, 'semilla.json'), JSON.stringify({pesos: Array.from(w, x => +x.toFixed(5)), vanilla: va, imitador: ia}));
