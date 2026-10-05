// LA SEMILLA DEL CAZADOR (11-10). El coyote arrancaba con la red de un cerdo (la de Cresta salvaje): sabe ir al pasto y al agua,
// no sabe vivir de cazar. En 15 mundos medidos se extinguio en los 15, entre el minuto 30 y el 120, con cualquier receta.
// Esto le entrena una red propia, igual que se entreno la del cerdo: estrategias evolutivas (OpenAI-ES, Salimans 2017) con premio
// de HOMEOSTASIS (Keramati y Gutkin 2014): no se le dice "caza"; se premia estar comido, tomado, descansado y sano, y seguir vivo.
// Corre sobre el MISMO mundo del juego (src/mundoVivo.js), con cerdos de verdad (su red, fija) y sin gente.
//   L=600 node tools/vivo/entrenar-cazador.mjs [generaciones=40] [hilos=4] [especie=coyote]
// Sale: public/<especie>-semilla.json {pesos, generacion, aptitud} (y una copia cada 10 generaciones en tools/vivo/semillas/)
// Variables: POB (perturbaciones por generacion, de a pares; 24), MUNDOS (mundos por evaluacion; 2), MINUTOS (de mundo por evaluacion; 75),
//   DESDE (archivo .json del que seguir; si no, arranca de la red del cerdo), SIGMA (0.06), PASO (0.04)
import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
import {Worker, isMainThread, parentPort, workerData} from 'worker_threads';
const aqui = path.dirname(fileURLToPath(import.meta.url)), raiz = path.join(aqui, '..', '..'), e = process.env;
const m = await import('../../src/mundoVivo.js');
const ESP = isMainThread ? (process.argv[4] || 'coyote') : workerData.esp, MINUTOS = +(e.MINUTOS || 75), MUNDOS = +(e.MUNDOS || 2);
const cerdo = JSON.parse(fs.readFileSync(path.join(raiz, 'public', 'cresta-salvaje.json'), 'utf8')).pesos;
// UNA EVALUACION: mundos chicos con cerdos y N cazadores con la red candidata. Aptitud = bienestar medio de los cazadores por
// cazador inicial y por instante (el muerto vale 0; los hijos suman: tener cria es vivir bien)
function evaluar(w, semilla0) {
  let total = 0; const d = (m.L / 600) ** 2, N0 = Math.max(4, Math.round(6 * d));
  for (let k = 0; k < MUNDOS; k++) { m.sembrar(semilla0 * 131 + k);
    const M = m.crearMundo({semillas: {cerdo, coyote: w}, sinLlegadas: true, n: {cerdo: Math.round(24 * d), coyote: N0}, tribus: {}, nOasis: Math.max(2, Math.round(3 * d))});
    let f = 0, muestras = 0; for (let t = 0; t < MINUTOS * 60; t += 20) { for (let i = 0; i < 40; i++) m.paso(M, 0.5); muestras++;
      for (const a of M.pob[ESP]) if (a.vivo) f += 1 - (a.hambre + a.sed + a.cansancio + (1 - a.salud)) / 4; }
    total += f / (muestras * N0); }
  return total / MUNDOS;
}
if (!isMainThread) { parentPort.on('message', ({id, w, semilla}) => parentPort.postMessage({id, f: evaluar(Float32Array.from(w), semilla)})); }
else {
  const GENS = +process.argv[2] || 40, HILOS = +process.argv[3] || 4, POB = +(e.POB || 24), SIGMA = +(e.SIGMA || 0.06), PASO = +(e.PASO || 0.04);
  const salida = path.join(raiz, 'public', ESP + '-semilla.json'), dirS = path.join(aqui, 'semillas'); fs.mkdirSync(dirS, {recursive: true});
  let w = Float32Array.from(cerdo), gen0 = 0; const desde = e.DESDE || (fs.existsSync(salida) ? salida : null);
  if (desde) { const j = JSON.parse(fs.readFileSync(desde, 'utf8')); if (j.pesos.length === w.length) { w = Float32Array.from(j.pesos); gen0 = j.generacion || 0; } }
  const obreros = Array.from({length: HILOS}, () => new Worker(new URL(import.meta.url), {workerData: {esp: ESP}})), espera = new Map(); let nId = 0, turno = 0;
  for (const o of obreros) o.on('message', ({id, f}) => { espera.get(id)(f); espera.delete(id); });
  const pedir = (ww, semilla) => new Promise(ok => { const id = nId++; espera.set(id, ok); obreros[turno++ % HILOS].postMessage({id, w: ww, semilla}); });
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); };
  console.log(`${ESP}: ${w.length} pesos, desde ${desde ? 'la generacion ' + gen0 : 'la red del cerdo'} · ${GENS} generaciones de ${POB} pares x ${MUNDOS} mundos de ${MINUTOS} min (lado ${m.L} m), ${HILOS} hilos`);
  const t0 = Date.now();
  for (let g = gen0 + 1; g <= gen0 + GENS; g++) {
    const eps = [], tareas = [];
    for (let i = 0; i < POB; i++) { const en = Float32Array.from({length: w.length}, gauss); eps.push(en);   // (de a pares, +e y -e, en los MISMOS mundos: lo que cambia es la red, no la suerte)
      for (const s of [1, -1]) { const c = new Float32Array(w.length); for (let k = 0; k < c.length; k++) c[k] = w[k] + s * SIGMA * en[k]; tareas.push(pedir(c, g)); } }
    tareas.push(pedir(w, g)); const fs_ = await Promise.all(tareas), centro = fs_.pop();
    // por RANGOS (no por el valor crudo: un mundo con suerte no arrastra todo)
    const orden = fs_.map((f, i) => [f, i]).sort((a, b) => a[0] - b[0]), rango = new Float32Array(fs_.length); orden.forEach(([, i], r) => { rango[i] = r / (fs_.length - 1) - 0.5; });
    for (let i = 0; i < POB; i++) { const dif = rango[2 * i] - rango[2 * i + 1], en = eps[i]; for (let k = 0; k < w.length; k++) w[k] += PASO / (POB * SIGMA) * dif * en[k] * SIGMA; }
    const mejor = Math.max(...fs_), med = fs_.reduce((a, b) => a + b, 0) / fs_.length;
    console.log(`gen ${g} · la red de ahora ${centro.toFixed(3)} · media ${med.toFixed(3)} · la mejor ${mejor.toFixed(3)} · ${Math.round((Date.now() - t0) / 1000)} s`);
    const j = JSON.stringify({especie: ESP, generacion: g, aptitud: +centro.toFixed(4), minutos: MINUTOS, lado: m.L, pesos: Array.from(w, v => Math.round(v * 1e5) / 1e5)});
    fs.writeFileSync(salida, j); if (g % 10 === 0) fs.writeFileSync(path.join(dirS, `${ESP}-gen${g}.json`), j);
  }
  for (const o of obreros) o.terminate();
}
