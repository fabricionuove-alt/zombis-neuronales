// MAP-ELITES (Mouret y Clune 2015) con mutacion Iso+LineDD (Vassiliades y Mouret 2018): un archivo de 8x8 especies segun
// dos conductas -cuanto gimen (llaman a otros) y cuanta paciencia tienen (ir lento teniendo una presa en la cabeza)- y en
// cada casilla el mejor cazador de ese estilo. Cada genoma se prueba como manada (12 copias) en 6 barrios, arrancando de la semilla que imita al zombi de PZ (imitar.mjs).
// Uso: node evolucionar.mjs [generaciones=150] [hijos por generacion=96] [hilos=22]  -> archivo.json, evolucion.log
import {Worker, isMainThread, parentPort} from 'node:worker_threads';
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {vivir, ZOMBI} from './mundo.js';
import {nPesos} from './red.js';

const aqui = path.dirname(fileURLToPath(import.meta.url)), N = nPesos(ZOMBI.nEnt, ZOMBI.nAcc), LADO = 8;
if (!isMainThread) {
  parentPort.on('message', tareas => parentPort.postMessage(tareas.map(t => {
    const rs = t.semillas.map(s => vivir(t.g ? Float32Array.from(t.g) : null, s)), p = k => rs.reduce((a, r) => a + r[k], 0) / rs.length;
    return {id: t.id, apt: p('apt'), muertes: p('muertes'), gemir: p('gemir'), paciencia: p('paciencia')};
  })));
} else {
  const GENS = +process.argv[2] || 150, HIJOS = +process.argv[3] || 96, HILOS = +process.argv[4] || 22;
  const trab = Array.from({length: HILOS}, () => new Worker(fileURLToPath(import.meta.url)));
  const pedir = (w, t) => new Promise(r => { w.once('message', r); w.postMessage(t); });
  const evaluar = async tareas => (await Promise.all(Array.from({length: HILOS}, (_, k) => pedir(trab[k], tareas.filter((_, i) => i % HILOS === k))))).flat();
  let s0 = 7; const u = () => { s0 = (Math.imul(s0, 1664525) + 1013904223) >>> 0; return (s0 + 1) / 4294967297; };
  const gauss = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(6.2832 * u());
  const log = m => { console.log(m); fs.appendFileSync(path.join(aqui, 'evolucion.log'), m + '\n'); };
  const ruta = path.join(aqui, 'archivo.json'), SEMILLA = JSON.parse(fs.readFileSync(path.join(aqui, 'semilla.json'), 'utf8')).pesos;
  const arch = fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf8')) : {gen: 0, celdas: {}};
  const casilla = r => Math.min(LADO - 1, Math.floor(r.gemir * LADO)) + ',' + Math.min(LADO - 1, Math.floor(r.paciencia * LADO));
  const PRUEBA = Array.from({length: 48}, (_, i) => 90001 + i);   // barrios que nunca se usan para entrenar
  const base = await evaluar(PRUEBA.map((s, i) => ({id: i, g: null, semillas: [s]})));
  const vanillaApt = base.reduce((a, r) => a + r.apt, 0) / base.length, vanillaMuertes = base.reduce((a, r) => a + r.muertes, 0) / base.length;
  log(`VANILLA en los ${PRUEBA.length} barrios de prueba: infeccion esperada ${vanillaApt.toFixed(3)} de 2, sobrevivientes muertos ${vanillaMuertes.toFixed(2)}/2`);
  const t0 = Date.now();
  for (let g = 0; g < GENS; g++, arch.gen++) {
    const elites = Object.values(arch.celdas), tareas = [];
    const sem = Array.from({length: 12}, (_, k) => 1000 + arch.gen * 17 + k);   // (los mismos 12 barrios para todos: comparan parejo)
    for (let i = 0; i < HIJOS; i++) { let h;
      if (!elites.length || u() < 0.15) { const sg = 0.02 + 0.1 * u(); h = SEMILLA.map(w => w + sg * gauss()); h[N - 1] += -1 + 5 * u(); h[N - 5] += -3 + 3 * u(); }   // (+ empujon a las ganas de gemir y a la velocidad, para que nazcan estilos distintos)   // (hijos frescos: la semilla que imita a PZ, mutada)
      else { const a = elites[Math.floor(u() * elites.length)].pesos, b = elites[Math.floor(u() * elites.length)].pesos, k = gauss() * 0.1;
        const sg = u() < 0.5 ? 0.015 : 0.06; h = a.map((w, q) => w + sg * gauss() + k * (b[q] - w)); }
      tareas.push({id: i, g: h, semillas: sem}); }
    // RE-EVALUAR: hasta 24 elites vuelven a jugar en estos barrios y su puntaje pasa a ser el promedio de todas sus
    // pruebas; asi una elite que tuvo suerte una vez baja a lo que vale de verdad (MAP-Elites con ruido, Flageat y Cully 2020)
    const reev = [...elites].sort(() => u() - 0.5).slice(0, 24);
    reev.forEach((e, k) => tareas.push({id: HIJOS + k, g: e.pesos, semillas: sem}));
    const res = await evaluar(tareas); let nuevas = 0, mejoras = 0;
    for (const r of res) if (r.id >= HIJOS) { const e = reev[r.id - HIJOS], n = e.n || 1; e.apt = (e.apt * n + r.apt) / (n + 1); e.n = n + 1; }
    for (const r of res) { if (r.id >= HIJOS) continue; const c = casilla(r), e = arch.celdas[c];
      if (!e || r.apt > e.apt) { if (!e) nuevas++; else mejoras++; arch.celdas[c] = {apt: r.apt, n: 1, muertes: r.muertes, gemir: r.gemir, paciencia: r.paciencia, gen: arch.gen, pesos: tareas[r.id].g.map(w => +w.toFixed(4))}; } }
    const es = Object.values(arch.celdas), mejor = es.reduce((m, e) => e.apt > m.apt ? e : m, es[0]);
    log(JSON.stringify({gen: arch.gen, especies: es.length, nuevas, mejoras, mejor: +mejor.apt.toFixed(3), media: +(es.reduce((a, e) => a + e.apt, 0) / es.length).toFixed(3), seg: Math.round((Date.now() - t0) / 1000)}));
    if (g % 10 === 9 || g === GENS - 1) {   // las 5 mejores especies (con 3+ pruebas), en barrios que no vieron, contra vanilla
      const top = [...es].filter(e => (e.n || 1) >= 3).sort((a, b) => b.apt - a.apt).slice(0, 5), pr = [];
      top.forEach((e, k) => PRUEBA.forEach(s => pr.push({id: k, g: e.pesos, semillas: [s]})));
      const rr = await evaluar(pr), linea = top.map((e, k) => { const m = rr.filter(r => r.id === k); return `${(m.reduce((a, r) => a + r.apt, 0) / m.length).toFixed(3)}/${(m.reduce((a, r) => a + r.muertes, 0) / m.length).toFixed(2)}`; });
      log(`PRUEBA gen ${arch.gen} (infeccion esperada de 2 / muertes) top5: ${linea.join('  ')}   vanilla: ${vanillaApt.toFixed(3)}/${vanillaMuertes.toFixed(2)}`);
      arch.vanilla = {apt: vanillaApt, muertes: vanillaMuertes}; fs.writeFileSync(ruta, JSON.stringify(arch));
    }
  }
  await Promise.all(trab.map(w => w.terminate()));
}
