// Compara dos campeones (antes / ahora) en conducta: mismo formato que describir.mjs
import fs from 'node:fs'; import {crearEpisodio, paso} from './mundo.js'; import {REGLAS} from './tutor/reglas.js';
const [fa, ea, fb, eb] = process.argv.slice(2), A = JSON.parse(fs.readFileSync(fa, 'utf8'))[ea].pesos, B = JSON.parse(fs.readFileSync(fb, 'utf8'))[eb].pesos;
const base = REGLAS.find(r => r.nombre === 'foco-arrastre').politica;
for (const nh of [1, 2, 3, 4]) { console.log(`\n=== ${nh} sobreviviente(s) ===`);
  for (const [nombre, g, b] of [['vanilla', null, null], ['antes ' + ea, Float32Array.from(A), base], ['ahora ' + eb, Float32Array.from(B), base]]) {
    const S = {inf: 0, agarres: 0, heridas: 0, mordidas: 0, arrastres: 0, zm: 0, lados: [0, 0, 0], n: [0, 0, 0], primera: [], pegado: 0};
    for (let s = 90001; s <= 90144; s++) { const ep = crearEpisodio(s, g, {nh, nz: 8, cerca: true, duracion: 45, base: b}); while (!ep.fin) paso(ep);
      S.inf += ep.humanos.reduce((q, h) => q + 1 - h.sano, 0) / nh; S.agarres += ep.agarres; S.heridas += ep.heridas; S.mordidas += ep.mordidas; S.arrastres += ep.arrastres; S.zm += ep.zombisMuertos;
      ep.lados.forEach((v, i) => S.lados[i] += v); ep.nAtac.forEach((v, i) => S.n[i] += v); if (ep.primera >= 0) S.primera.push(ep.primera); S.pegado += ep.pegado; }
    const P = x => (x / 144).toFixed(2), tl = S.lados.reduce((a, b) => a + b) || 1, tn = S.n.reduce((a, b) => a + b) || 1, med = S.primera.length ? S.primera.sort((a, b) => a - b)[S.primera.length >> 1].toFixed(0) + 's' : '-';
    console.log(`${nombre.padEnd(17)} infeccion ${(S.inf / 144).toFixed(3)} | agarres ${P(S.agarres)} mordidas ${P(S.mordidas)} arrastres ${P(S.arrastres)} | frente/costado/atras ${S.lados.map(v => Math.round(v / tl * 100)).join('/')}% | 1/2/3+ a la vez ${S.n.map(v => Math.round(v / tn * 100)).join('/')}% | 1a herida ${med} | zombis muertos ${P(S.zm)} | seg pegados ${P(S.pegado)}`); } }
