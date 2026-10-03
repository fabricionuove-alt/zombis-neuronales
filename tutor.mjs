// LA TUTORA: prueba las reglas de tutor/reglas.js contra el vanilla en el nivel actual del torneo y, si sirven, las pasa
// a una red RESIDUAL (aprendizaje supervisado sobre lo que hace la regla) que deja en tutor/inyectar/ para que el torneo
// la meta en sus cuatro estrategias. Uso: node tutor.mjs [nombre de regla | todas]
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {crearEpisodio, paso, vivir, ZOMBI} from './mundo.js';
import {nPesos, OCULTAS} from './red.js';
import {REGLAS} from './tutor/reglas.js';
const aqui = path.dirname(fileURLToPath(import.meta.url)), NE = ZOMBI.nEnt, NS = 2 + ZOMBI.nAcc, H = OCULTAS, N = nPesos(NE, ZOMBI.nAcc);
const iWh = NE * H, iB = iWh + H * H, iWo = iB + H, iBo = iWo + H * NS;
const nivel = (() => { try { return JSON.parse(fs.readFileSync(path.join(aqui, 'estrategias', 'nivel.json'), 'utf8')).nivel; } catch (e) { return 1; } })();
const OPC = {nh: Math.min(4, nivel), nz: 8, cerca: true, duracion: 45}, PRUEBA = Array.from({length: 144}, (_, i) => 90001 + i);
const medir = (g, tutor) => { let a = 0, m = 0; for (const s of PRUEBA) { const r = tutor ? (() => { const ep = crearEpisodio(s, null, {...OPC, tutor}); while (!ep.fin) paso(ep); return {apt: ep.humanos.reduce((q, h) => q + 1 - h.sano, 0), mordidas: ep.mordidas}; })() : vivir(g, s, OPC); a += r.apt; m += r.mordidas; } return {inf: a / PRUEBA.length / OPC.nh, mord: m / PRUEBA.length}; };
const cual = process.argv[2] || 'todas', van = medir(null);
console.log(`nivel ${OPC.nh}: VANILLA infeccion por sobreviviente ${van.inf.toFixed(3)}, mordidas por partida ${van.mord.toFixed(2)}`);
const destilar = process.argv.includes('destilar');
for (const R of REGLAS.filter(r => cual === 'todas' || r.nombre === cual)) {
  const rr = medir(null, R.politica); console.log(`REGLA ${R.nombre}: ${rr.inf.toFixed(3)} (${((rr.inf / van.inf - 1) * 100).toFixed(0)}% vs vanilla), mordidas ${rr.mord.toFixed(2)}`);
  if (!destilar) continue;
  // grabar lo que hace la regla y pasarlo a la red residual
  const grabar = {prob: 0.3, datos: []}; for (let s = 1; s <= 400; s++) { const ep = crearEpisodio(700000 + s, null, {...OPC, tutor: R.politica, grabar}); while (!ep.fin) paso(ep); }
  const D = grabar.datos; let s0 = 5; const u = () => { s0 = (Math.imul(s0, 1664525) + 1013904223) >>> 0; return (s0 + 1) / 4294967297; };
  const w = new Float32Array(N); for (let i = 0; i < iWh; i++) w[i] = (u() - 0.5) * 0.2; for (let i = iWo; i < iBo; i++) w[i] = (u() - 0.5) * 0.2; w[iBo + 5] = -2;
  const m = new Float32Array(N), v = new Float32Array(N), gr = new Float32Array(N), h = new Float32Array(H), o = new Float32Array(NS), dh = new Float32Array(H), dO = new Float32Array(NS); let t = 0;
  for (let ep = 0; ep < 20; ep++) {
    for (let i = D.length - 1; i > 0; i--) { const j = Math.floor(u() * (i + 1)); [D[i], D[j]] = [D[j], D[i]]; } let perd = 0, bien = 0;
    for (let b0 = 0; b0 < D.length; b0 += 256) { gr.fill(0); const nb = Math.min(256, D.length - b0);
      for (let q = b0; q < b0 + nb; q++) { const [x, tg, tv, ta, tgem, vg, vv, va] = D[q];
        for (let j = 0; j < H; j++) { let s = w[iB + j]; for (let i = 0; i < NE; i++) s += w[j * NE + i] * x[i]; h[j] = Math.tanh(s); }
        for (let k = 0; k < NS; k++) { let s = w[iBo + k]; for (let j = 0; j < H; j++) s += w[iWo + k * H + j] * h[j]; o[k] = s; }
        const dg = Math.max(-0.99, Math.min(0.99, tg - vg)), dv = Math.max(-0.99, Math.min(0.99, tv - vv));   // (lo que la regla cambia respecto del vanilla)
        const g0 = Math.tanh(o[0]); dO[0] = 2 * (g0 - dg) * (1 - g0 * g0); perd += (g0 - dg) ** 2;
        const sv = 1 / (1 + Math.exp(-o[1])), r1 = 2 * sv - 1; dO[1] = 2 * (r1 - dv) * 2 * sv * (1 - sv); perd += (r1 - dv) ** 2;
        const L = [0, 1, 2].map(k => o[2 + k] + (k === va ? 2 : 0)), mx = Math.max(...L), ex = L.map(l => Math.exp(l - mx)), z = ex.reduce((a, b) => a + b), p = ex.map(e => e / z);
        for (let k = 0; k < 3; k++) dO[2 + k] = (p[k] - (k === ta ? 1 : 0)) * (k === ta && ta !== va ? 3 : 1); perd -= Math.log(p[ta] + 1e-9); if (p.indexOf(Math.max(...p)) === ta) bien++;
        const sg = 1 / (1 + Math.exp(-o[5])); dO[5] = sg - tgem;
        dh.fill(0); for (let k = 0; k < NS; k++) { gr[iBo + k] += dO[k]; for (let j = 0; j < H; j++) { gr[iWo + k * H + j] += dO[k] * h[j]; dh[j] += dO[k] * w[iWo + k * H + j]; } }
        for (let j = 0; j < H; j++) { const ds = dh[j] * (1 - h[j] * h[j]); gr[iB + j] += ds; for (let i = 0; i < NE; i++) gr[j * NE + i] += ds * x[i]; } }
      t++; for (let i = 0; i < N; i++) { if (i >= iWh && i < iB) continue; const g = gr[i] / nb; m[i] = 0.9 * m[i] + 0.1 * g; v[i] = 0.999 * v[i] + 0.001 * g * g; w[i] -= 0.003 * (m[i] / (1 - 0.9 ** t)) / (Math.sqrt(v[i] / (1 - 0.999 ** t)) + 1e-8); } }
    if (ep % 5 === 4) console.log(`  red ${R.nombre} epoca ${ep}: perdida ${(perd / D.length).toFixed(3)}, accion acertada ${(bien / D.length * 100).toFixed(1)}%`);
  }
  const rn = medir(w); console.log(`  RED de ${R.nombre}: ${rn.inf.toFixed(3)} (${((rn.inf / van.inf - 1) * 100).toFixed(0)}% vs vanilla), mordidas ${rn.mord.toFixed(2)}  -> tutor/inyectar/${R.nombre}.json`);
  fs.writeFileSync(path.join(aqui, 'tutor', 'inyectar', R.nombre + '.json'), JSON.stringify({nombre: R.nombre, fuente: R.fuente, nivel: OPC.nh, regla: rr.inf, red: rn.inf, vanilla: van.inf, pesos: Array.from(w, x => +x.toFixed(5))}));
}
