// Compara en que se diferencian el vanilla, la regla base y el campeon: de que lado muerden, cuantos atacan a la vez, etc.
import fs from 'node:fs'; import {crearEpisodio, paso} from './mundo.js'; import {REGLAS} from './tutor/reglas.js';
const C = JSON.parse(fs.readFileSync('campeones.json', 'utf8')), camp = C['sep-CMA-ES'].pesos, base = REGLAS.find(r => r.nombre === 'foco-arrastre').politica;
for (const nh of [1, 2, 4]) { console.log(`\n=== ${nh} sobreviviente(s), 8 zombis, 144 barrios ===`);
  for (const [nombre, g, b] of [['vanilla', null, null], ['regla base', null, base], ['campeon', Float32Array.from(camp), base]]) {
    const A = {inf: 0, agarres: 0, heridas: 0, mordidas: 0, arrastres: 0, zm: 0, lados: [0, 0, 0], n: [0, 0, 0], primera: [], gemidos: 0, pegado: 0};
    for (let s = 90001; s <= 90144; s++) { const ep = crearEpisodio(s, g, {nh, nz: 8, cerca: true, duracion: 45, base: b}); while (!ep.fin) paso(ep);
      A.inf += ep.humanos.reduce((q, h) => q + 1 - h.sano, 0) / nh; A.agarres += ep.agarres; A.heridas += ep.heridas; A.mordidas += ep.mordidas; A.arrastres += ep.arrastres; A.zm += ep.zombisMuertos;
      ep.lados.forEach((v, i) => A.lados[i] += v); ep.nAtac.forEach((v, i) => A.n[i] += v); if (ep.primera >= 0) A.primera.push(ep.primera); A.gemidos += ep.zombis.reduce((q, z) => q + z.gemidos, 0); A.pegado += ep.pegado; }
    const P = x => (x / 144).toFixed(2), tl = A.lados.reduce((a, b) => a + b) || 1, tn = A.n.reduce((a, b) => a + b) || 1, med = A.primera.length ? (A.primera.sort((a, b) => a - b)[A.primera.length >> 1]).toFixed(0) + ' s' : '-';
    console.log(`${nombre.padEnd(11)} infeccion ${(A.inf / 144).toFixed(3)} | agarres ${P(A.agarres)} heridas ${P(A.heridas)} mordidas ${P(A.mordidas)} arrastres ${P(A.arrastres)} | agarres de frente/costado/atras ${A.lados.map(v => Math.round(v / tl * 100) + '%').join('/')} | atacando a la vez 1/2/3+ ${A.n.map(v => Math.round(v / tn * 100) + '%').join('/')} | primera herida ${med} | zombis muertos ${P(A.zm)} | gemidos ${P(A.gemidos)} | seg pegados ${P(A.pegado)}`); } }
