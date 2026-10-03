// TORNEO DE ESTRATEGIAS EVOLUTIVAS: cuatro maneras de evolucionar el cerebro residual compiten por los mismos hilos.
//  - MAP-Elites (Mouret y Clune 2015) + Iso+LineDD + re-evaluacion de elites: muchas especies, una por estilo.
//  - OpenAI-ES (Salimans et al. 2017): un solo cerebro; estima hacia donde mejorar con pares de ruido +/- y Adam.
//  - sep-CMA-ES (Ros y Hansen 2008): CMA con covarianza diagonal (la completa no entra en 1470 pesos).
//  - Algoritmo genetico con elite (los padres se re-evaluan cada generacion para que no gane la suerte).
// Cada ronda: cada estrategia corre tantas partidas como su PRIORIDAD; despues el mejor de cada una juega los mismos 144
// barrios que nadie uso para entrenar, contra el vanilla. La prioridad se reparte por puesto (50/25/15/10%, minimo 10%).
// Uso: node torneo.mjs [rondas=20] [partidas por ronda=6000] [hilos=22]  -> torneo.log, estrategias/*.json, campeones.json
import {Worker, isMainThread, parentPort} from 'node:worker_threads';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import {fileURLToPath} from 'node:url';
import {vivir, ZOMBI} from './mundo.js';
import {nPesos} from './red.js';
import {REGLAS} from './tutor/reglas.js';
const BASES = Object.fromEntries(REGLAS.map(r => [r.nombre, r.politica]));

const aqui = path.dirname(fileURLToPath(import.meta.url)), N = nPesos(ZOMBI.nEnt, ZOMBI.nAcc), SEMS = 12;
if (!isMainThread) {
  parentPort.on('message', tareas => parentPort.postMessage(tareas.map(t => {
    const o = {...t.opc}; if (t.sinBase || !o.base) delete o.base; else o.base = BASES[o.base];   // (la base: una regla de la tutora que la red corrige)
    const rs = t.semillas.map(s => { if (o.nh !== 'mezcla') return vivir(t.g ? Float32Array.from(t.g) : null, s, o);   // (MEZCLA: cada barrio con 1 a 4 sobrevivientes)
      const nh = 1 + (s % 4), r = vivir(t.g ? Float32Array.from(t.g) : null, s, {...o, nh}); return {...r, apt: r.apt / nh, aptE: r.aptE / nh}; }), p = k => rs.reduce((a, r) => a + r[k], 0) / rs.length;
    return {id: t.id, apt: t.prueba ? p('apt') : p('aptE'), real: p('apt'), muertes: p('muertes'), gemir: p('gemir'), paciencia: p('paciencia')};   // (entrenar con credito parcial; probar con infeccion real)
  })));
} else {
  const RONDAS = +process.argv[2] || 20, PARTIDAS = +process.argv[3] || 6000, HILOS = +process.argv[4] || Math.max(1, os.cpus().length - 1);
  // ISLA (GitHub Actions): ISLA=n cambia los barrios y el azar; MINUTOS=m corta por tiempo; NIVEL=1..4 o "mezcla" fija el nivel
  const ISLA = +(process.env.ISLA || 0), MINUTOS = +(process.env.MINUTOS || 0), NIVEL_FIJO = process.env.NIVEL || null;
  const trab = Array.from({length: HILOS}, () => new Worker(fileURLToPath(import.meta.url)));
  const pedir = (w, t) => new Promise(r => { w.once('message', r); w.postMessage(t); });
  const NIV = (() => { try { return JSON.parse(fs.readFileSync(path.join(aqui, 'estrategias', 'nivel.json'), 'utf8')); } catch (e) { return {nivel: 1, rondas: 0}; } })();
  if (NIVEL_FIJO) NIV.nivel = NIVEL_FIJO === 'mezcla' ? 'mezcla' : +NIVEL_FIJO;
  const OPC = () => ({nh: NIV.nivel, nz: 8, cerca: true, duracion: 45, base: NIV.base || null});   // (CURRICULUM: 1 sobreviviente, despues 2, 3 y 4; zombis cerca, 45 s, termina al cazarlos)
  const evaluar = async tareas => { const o = OPC(); tareas.forEach(t => { t.opc = o; }); return (await Promise.all(Array.from({length: HILOS}, (_, k) => pedir(trab[k], tareas.filter((_, i) => i % HILOS === k))))).flat().sort((a, b) => a.id - b.id); };
  let s0 = 11 + ISLA * 7919; const u = () => { s0 = (Math.imul(s0, 1664525) + 1013904223) >>> 0; return (s0 + 1) / 4294967297; };
  const gauss = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(6.2832 * u());
  const log = m => { console.log(m); fs.appendFileSync(path.join(aqui, 'torneo.log'), m + '\n'); };
  const dir = path.join(aqui, 'estrategias'); fs.mkdirSync(dir, {recursive: true});
  const leer = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return d; } };
  const guardar = (f, o) => fs.writeFileSync(path.join(dir, f), JSON.stringify(o));
  const SEMILLA = JSON.parse(fs.readFileSync(path.join(aqui, 'semilla.json'), 'utf8')).pesos;
  let semGen = 1 + ISLA * 1000000; const semillas = () => { semGen++; return Array.from({length: SEMS}, (_, k) => 100000 * semGen + k); };
  const PARTIDAS_GEN = g => g.length * SEMS;

  // ---- MAP-Elites (continua el archivo.json de evolucionar.mjs si existe) ----
  const ME = {nombre: 'MAP-Elites', arch: fs.existsSync(path.join(aqui, 'archivo.json')) ? JSON.parse(fs.readFileSync(path.join(aqui, 'archivo.json'), 'utf8')) : {gen: 0, celdas: {}},
    async gen() { const el = Object.values(this.arch.celdas), sem = semillas(), t = [];
      for (let i = 0; i < 48; i++) { let h;
        if (!el.length || u() < 0.15) { const sg = 0.02 + 0.1 * u(); h = SEMILLA.map(w => w + sg * gauss()); h[N - 1] += -1 + 5 * u(); h[N - 5] += -3 + 3 * u(); }
        else { const a = el[Math.floor(u() * el.length)].pesos, b = el[Math.floor(u() * el.length)].pesos, k = gauss() * 0.1, sg = u() < 0.5 ? 0.015 : 0.06; h = a.map((w, q) => w + sg * gauss() + k * (b[q] - w)); }
        t.push({id: i, g: h, semillas: sem}); }
      const reev = [...el].sort(() => u() - 0.5).slice(0, 16); reev.forEach((e, k) => t.push({id: 48 + k, g: e.pesos, semillas: sem}));
      const res = await evaluar(t);
      for (const r of res) if (r.id >= 48) { const e = reev[r.id - 48], n = e.n || 1; e.apt = (e.apt * n + r.apt) / (n + 1); e.n = n + 1; }
      for (const r of res) { if (r.id >= 48) continue; const c = Math.min(7, Math.floor(r.gemir * 8)) + ',' + Math.min(7, Math.floor(r.paciencia * 8)), e = this.arch.celdas[c];
        if (!e || r.apt > e.apt) this.arch.celdas[c] = {apt: r.apt, n: 1, muertes: r.muertes, gemir: r.gemir, paciencia: r.paciencia, gen: this.arch.gen, pesos: t[r.id].g.map(w => +w.toFixed(4))}; }
      this.arch.gen++; return t.length * SEMS; },
    async reajustar() { const el = Object.values(this.arch.celdas); if (!el.length) return; const sem = semillas(), r = await evaluar(el.map((e, i) => ({id: i, g: e.pesos, semillas: sem}))); r.forEach(x => { el[x.id].apt = x.apt; el[x.id].n = 1; }); },
    mejor() { const el = Object.values(this.arch.celdas).filter(e => (e.n || 1) >= 3).sort((a, b) => b.apt - a.apt); return el[0]?.pesos || null; },
    guardar() { fs.writeFileSync(path.join(aqui, 'archivo.json'), JSON.stringify(this.arch)); }};

  // ---- OpenAI-ES ----
  const ES = {nombre: 'OpenAI-ES', ...leer('es.json', {theta: SEMILLA.slice(), m: new Array(N).fill(0), v: new Array(N).fill(0), t: 0}),
    async gen() { const sem = semillas(), P = 24, SIG = 0.03, ruidos = [], t = [];
      for (let p = 0; p < P; p++) { const e = Array.from({length: N}, gauss); ruidos.push(e); for (const sg of [1, -1]) t.push({id: t.length, g: this.theta.map((w, q) => w + sg * SIG * e[q]), semillas: sem}); }
      const res = await evaluar(t), orden = [...res].sort((a, b) => a.apt - b.apt); orden.forEach((r, i) => { r.rango = i / (orden.length - 1) - 0.5; });
      const grad = new Array(N).fill(0); res.forEach(r => { const e = ruidos[Math.floor(r.id / 2)], k = r.rango * (r.id % 2 ? -1 : 1); for (let q = 0; q < N; q++) grad[q] += k * e[q]; });
      this.t++; for (let q = 0; q < N; q++) { const g = grad[q] / (res.length * SIG) - 0.002 * this.theta[q]; this.m[q] = 0.9 * this.m[q] + 0.1 * g; this.v[q] = 0.999 * this.v[q] + 0.001 * g * g;
        this.theta[q] += 0.01 * (this.m[q] / (1 - 0.9 ** this.t)) / (Math.sqrt(this.v[q] / (1 - 0.999 ** this.t)) + 1e-8); }
      return t.length * SEMS; },
    async reajustar() {}, mejor() { return this.theta; }, guardar() { guardar('es.json', {theta: this.theta, m: this.m, v: this.v, t: this.t}); }};

  // ---- sep-CMA-ES ----
  const LAM = 24, MU = 12, W = (() => { const w = Array.from({length: MU}, (_, i) => Math.log(MU + 0.5) - Math.log(i + 1)), s = w.reduce((a, b) => a + b); return w.map(x => x / s); })();
  const MUEFF = 1 / W.reduce((a, w) => a + w * w, 0), CS = (MUEFF + 2) / (N + MUEFF + 5), DS = 1 + CS + 2 * Math.max(0, Math.sqrt((MUEFF - 1) / (N + 1)) - 1);
  const C1n = 2 / ((N + 1.3) ** 2 + MUEFF), CMUn = Math.min(1 - C1n, 2 * (MUEFF - 2 + 1 / MUEFF) / ((N + 2) ** 2 + MUEFF));   // (Hansen, tutorial CMA-ES)
  const CC = 4 / (N + 4), C1 = C1n * (N + 2) / 3, CMU = Math.min(1 - C1, CMUn * (N + 2) / 3), CHI = Math.sqrt(N) * (1 - 1 / (4 * N) + 1 / (21 * N * N));
  const CMA = {nombre: 'sep-CMA-ES', ...leer('cma.json', {m: SEMILLA.slice(), sigma: 0.05, d: new Array(N).fill(1), ps: new Array(N).fill(0), pc: new Array(N).fill(0), ng: 0}),
    async gen() { const sem = semillas(), zs = [], t = [];
      for (let i = 0; i < LAM; i++) { const z = Array.from({length: N}, gauss); zs.push(z); t.push({id: i, g: this.m.map((w, q) => w + this.sigma * Math.sqrt(this.d[q]) * z[q]), semillas: sem}); }
      const res = await evaluar(t), orden = [...res].sort((a, b) => b.apt - a.apt).slice(0, MU);
      const zw = new Array(N).fill(0); orden.forEach((r, i) => { for (let q = 0; q < N; q++) zw[q] += W[i] * zs[r.id][q]; });
      for (let q = 0; q < N; q++) this.m[q] += this.sigma * Math.sqrt(this.d[q]) * zw[q];
      let nps = 0; for (let q = 0; q < N; q++) { this.ps[q] = (1 - CS) * this.ps[q] + Math.sqrt(CS * (2 - CS) * MUEFF) * zw[q]; nps += this.ps[q] ** 2; }
      const hs = Math.sqrt(nps) / Math.sqrt(1 - (1 - CS) ** (2 * (this.ng + 1))) < (1.4 + 2 / (N + 1)) * CHI ? 1 : 0;
      for (let q = 0; q < N; q++) { const y = Math.sqrt(this.d[q]) * zw[q]; this.pc[q] = (1 - CC) * this.pc[q] + hs * Math.sqrt(CC * (2 - CC) * MUEFF) * y;
        let rmu = 0; orden.forEach((r, i) => { rmu += W[i] * this.d[q] * zs[r.id][q] ** 2; });
        this.d[q] = Math.max(1e-6, (1 - C1 - CMU) * this.d[q] + C1 * this.pc[q] ** 2 + CMU * rmu); }
      this.sigma *= Math.exp((CS / DS) * (Math.sqrt(nps) / CHI - 1)); this.sigma = Math.min(0.2, Math.max(0.002, this.sigma)); this.ng++;
      return t.length * SEMS; },
    async reajustar() {}, mejor() { return this.m; }, guardar() { guardar('cma.json', {m: this.m, sigma: this.sigma, d: this.d, ps: this.ps, pc: this.pc, ng: this.ng}); }};

  // ---- Algoritmo genetico con elite ----
  const GA = {nombre: 'Genetico', ...leer('ga.json', {padres: [], ng: 0}),
    async gen() { const sem = semillas(), t = [];
      if (!this.padres.length) this.padres = [{g: SEMILLA.slice(), apt: 0, n: 0}];
      this.padres.forEach((p, k) => t.push({id: k, g: p.g, semillas: sem}));   // (los padres vuelven a jugar: su puntaje es el promedio)
      const np = this.padres.length; for (let i = 0; i < 36; i++) { const a = this.padres[Math.floor(u() * np)].g, b = this.padres[Math.floor(u() * np)].g, sg = u() < 0.5 ? 0.02 : 0.06;
        t.push({id: np + i, g: a.map((w, q) => (u() < 0.5 ? w : b[q]) + sg * gauss()), semillas: sem}); }
      const res = await evaluar(t);
      res.forEach(r => { if (r.id < np) { const p = this.padres[r.id]; p.apt = (p.apt * p.n + r.apt) / (p.n + 1); p.n++; } });
      const hijos = res.filter(r => r.id >= np).map(r => ({g: t[r.id].g, apt: r.apt, n: 1}));
      this.padres = [...this.padres, ...hijos].sort((a, b) => b.apt - a.apt).slice(0, 12); this.ng++;
      return t.length * SEMS; },
    async reajustar() { this.padres.forEach(p => { p.apt = 0; p.n = 0; }); },
    mejor() { const p = this.padres.filter(p => p.n >= 3).sort((a, b) => b.apt - a.apt)[0] || this.padres[0]; return p?.g || null; },
    guardar() { guardar('ga.json', {padres: this.padres.map(p => ({g: p.g.map(w => +w.toFixed(4)), apt: p.apt, n: p.n})), ng: this.ng}); }};

  const ESTR = [ME, ES, CMA, GA], prior = leer('prioridad.json', {p: [0.25, 0.25, 0.25, 0.25], historia: []});
  const PRUEBA = Array.from({length: 144}, (_, i) => 90001 + i);   // (144: la infeccion es rara y con menos barrios el ruido tapa la diferencia)
  const probar = async g => { const r = await evaluar(PRUEBA.map((s, i) => ({id: i, g, semillas: [s], prueba: true}))); return {apt: r.reduce((a, x) => a + x.apt, 0) / r.length, muertes: r.reduce((a, x) => a + x.muertes, 0) / r.length}; };
  let van; const campeones = {};
  const empezarNivel = async () => { van = await (async () => { const r = await evaluar(PRUEBA.map((s, i) => ({id: i, g: null, semillas: [s], prueba: true, sinBase: true}))); return {apt: r.reduce((a, x) => a + x.apt, 0) / r.length, muertes: 0}; })();
    if (NIV.base) { const b = await probar(null); campeones.base = {apt: b.apt, nombre: NIV.base}; log(`BASE ${NIV.base} sola: ${(NIV.nivel === 'mezcla' ? b.apt : b.apt / NIV.nivel).toFixed(3)} por sobreviviente`); } campeones.vanilla = {apt: van.apt, nivel: NIV.nivel};
    const porS = x => NIV.nivel === 'mezcla' ? x : x / NIV.nivel;
    log(`ISLA ${ISLA} NIVEL ${NIV.nivel} (8 zombis cerca, 45 s): VANILLA en 144 barrios de prueba: infeccion ${porS(van.apt).toFixed(3)} por sobreviviente`);
    for (const e of ESTR) await e.reajustar(); };
  if (!NIVEL_FIJO && NIV.nivel > 4) { log('YA TERMINO EL CURRICULUM (nivel 4 superado); usar NIVEL=mezcla para seguir'); process.exit(0); }
  await empezarNivel();
  const t0 = Date.now();
  const r0 = prior.historia.length;
  for (let ronda = r0; ronda < r0 + RONDAS; ronda++) {
    for (let i = 0; i < ESTR.length; i++) { let gastado = 0; const meta = PARTIDAS * prior.p[i]; while (gastado < meta) gastado += await ESTR[i].gen(); ESTR[i].guardar(); }
    const notas = [];
    for (const e of ESTR) { const g = e.mejor(); const r = g ? await probar(g) : {apt: 0, muertes: 0}; notas.push(r.apt);
      campeones[e.nombre] = {apt: r.apt, muertes: r.muertes, ronda, pesos: g ? Array.from(g, w => +(+w).toFixed(4)) : null}; }
    prior.historia.push({ronda, notas, seg: Math.round((Date.now() - t0) / 1000)});
    const ult = prior.historia.slice(-3), prom = notas.map((_, i) => ult.reduce((a, h) => a + h.notas[i], 0) / ult.length);   // (promedio de las ultimas 3 rondas: una sola es ruido)
    const orden = prom.map((n, i) => i).sort((a, b) => prom[b] - prom[a]), reparto = [0.5, 0.25, 0.15, 0.1];
    orden.forEach((i, puesto) => { prior.p[i] = reparto[puesto]; });
    guardar('prioridad.json', prior);
    fs.writeFileSync(path.join(aqui, 'campeones.json'), JSON.stringify(campeones));
    const pc = x => (NIV.nivel === 'mezcla' ? x : x / NIV.nivel).toFixed(3);
    log(`RONDA ${ronda} NIVEL ${NIV.nivel} (${Math.round((Date.now() - t0) / 60000)} min) infeccion por sobreviviente, vanilla ${pc(van.apt)}: ` + ESTR.map((e, i) => `${e.nombre} ${pc(notas[i])} (prom3 ${pc(prom[i])}${prom[i] > van.apt ? ' +' + ((prom[i] / van.apt - 1) * 100).toFixed(0) + '%' : ''})`).join(' | ') +
      `  -> prioridad ` + ESTR.map((e, i) => `${e.nombre.split(/[- ]/)[0]} ${Math.round(prior.p[i] * 100)}%`).join(' '));
    NIV.rondas++; const mejorProm = Math.max(...prom);
    if (MINUTOS && Date.now() - t0 > MINUTOS * 60000) { log(`ISLA ${ISLA}: tiempo cumplido (${MINUTOS} min)`); break; }
    if (!NIVEL_FIJO && ((ult.length >= 3 && mejorProm >= 1.15 * van.apt) || NIV.rondas >= 8)) {   // (sube de nivel: supero al vanilla por 15% en 3 rondas, o ya van 8 rondas)
      log(`SUBE DE NIVEL: ${NIV.nivel} -> ${NIV.nivel + 1} (${mejorProm >= 1.15 * van.apt ? 'supero al vanilla +' + ((mejorProm / van.apt - 1) * 100).toFixed(0) + '%' : 'tope de 8 rondas, mejor ' + ((mejorProm / van.apt - 1) * 100).toFixed(0) + '%'})`);
      fs.writeFileSync(path.join(aqui, 'campeones-nivel' + NIV.nivel + '.json'), JSON.stringify(campeones));
      NIV.nivel++; NIV.rondas = 0; prior.historia = []; prior.p = [0.25, 0.25, 0.25, 0.25]; guardar('prioridad.json', prior);
      fs.writeFileSync(path.join(dir, 'nivel.json'), JSON.stringify(NIV)); if (NIV.nivel > 4) { log('CURRICULUM TERMINADO: nivel 4 superado'); break; }
      await empezarNivel(); }
    if (!NIVEL_FIJO) fs.writeFileSync(path.join(dir, 'nivel.json'), JSON.stringify(NIV));
  }
  await Promise.all(trab.map(w => w.terminate()));
}
