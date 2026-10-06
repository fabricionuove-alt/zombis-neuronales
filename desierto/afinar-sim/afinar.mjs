// AFINAR LA RED DE LA GENTE (14-10): el paso de ENTRENAMIENTO que faltaba. La red arranca imitando al maestro (public/semillas-vivo.json:
// el «arranque tibio», como VPT o AlphaGo), y aca se la afina con estrategias evolutivas (OpenAI-ES, Salimans 2017) y premio de
// BIENESTAR solamente (homeostasis, Keramati y Gutkin 2014): comido, tomado, descansado, sano y vivo. NO se premia volver a ningun
// lado, ni dormir bajo techo, ni construir: si eso aparece, es porque le sirve (la noche a la intemperie cuesta: ver «LA NOCHE Y EL
// TECHO» en src/mundoVivo.js). Los mundos son chicos y con varios dias y noches; todos los de la especie llevan la red candidata.
//   L=300 MINUTOS=14 node tools/vivo/afinar.mjs [especie=steve] [hilos=4]
// Cada generacion informa, ademas de la aptitud, LO QUE SE QUIERE VER SI EMERGE (no entra en el premio):
//   techo = que parte de la noche pasan bajo techo · refugios = cuantos levantaron por mundo · junto = que parte los levanto junto a otro
// Sale: public/semillas-afinadas.json (las cuatro redes, con la afinada en su lugar) y tools/vivo/afinar-avance.txt
// Variables: MINUTOS (de reloj; corta solo: nada corre mas de 20), POB (pares por generacion; 8), MUNDOS (por evaluacion; 2), DIAS (de mundo; 2), SIGMA (0.05), PASO (0.03)
import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
import {Worker, isMainThread, parentPort, workerData} from 'worker_threads';
const aqui = path.dirname(fileURLToPath(import.meta.url)), raiz = path.join(aqui, '..', '..'), e = process.env;
const m = await import('../../src/mundoVivo.js');
const ESP = isMainThread ? (process.argv[2] || 'steve') : workerData.esp, MUNDOS = +(e.MUNDOS || 2), DIAS = +(e.DIAS || 2);
const sv = JSON.parse(fs.readFileSync(path.join(raiz, 'public', e.DESDE || 'semillas-vivo.json'), 'utf8'));
// UNA EVALUACION: mundos chicos, con pasto, agua, cerdos, un par de lugares y un grupo de la especie con la red candidata
function evaluar(w, semilla0) {
  let apt = 0, techo = 0, refugios = 0, junto = 0; const d = (m.L / 300) ** 2; m.MUT.prob = 0;   // (sin mutacion al nacer: se mide ESTA red)
  for (let k = 0; k < MUNDOS; k++) { m.sembrar(semilla0 * 977 + k);
    const sG = {steve: sv.steve.pesos, arana: sv.arana.pesos}; sG[ESP] = w;
    const M = m.crearMundo({semillas: {cerdo: sv.cerdo.pesos, coyote: sv.coyote.pesos}, semillasG: sG, sinLlegadas: true, n: {cerdo: Math.round(8 * d), coyote: 0}, tribus: {[ESP]: Math.max(2, Math.round(2 * d))}, lugares: Math.max(1, Math.round(1 * d)), nOasis: Math.max(1, Math.round(1 * d))});
    const N0 = m.grupos(M).reduce((a, K) => a + K.miembros.length, 0); let f = 0, muestras = 0, nNoche = 0, nTecho = 0;
    for (let t = 0; t < DIAS * m.DIA; t += 20) { for (let i = 0; i < 40; i++) m.paso(M, 0.5); muestras++; const nK = m.noche(M);
      for (const K of m.grupos(M)) for (const a of K.miembros) if (a.vivo && a.esp === ESP) { f += 1 - (a.hambre + a.sed + a.cansancio + (1 - a.salud)) / 4; if (nK > 0.6) { nNoche++; if (a.techo) nTecho++; } } }
    apt += f / (muestras * N0); techo += nNoche ? nTecho / nNoche : 0; const h = M.cuenta.hizo, solo = h[ESP + ': levanto un refugio solo'] || 0, jt = h[ESP + ': levanto un refugio junto a otro'] || 0; refugios += solo + jt; junto += solo + jt ? jt / (solo + jt) : 0; }
  return {f: apt / MUNDOS, techo: techo / MUNDOS, refugios: refugios / MUNDOS, junto: junto / MUNDOS};
}
if (!isMainThread) { parentPort.on('message', ({id, w, semilla}) => parentPort.postMessage({id, r: evaluar(Float32Array.from(w), semilla)})); }
else {
  const HILOS = +process.argv[3] || 4, POB = +(e.POB || 8), SIGMA = +(e.SIGMA || 0.05), PASO = +(e.PASO || 0.03), TOPE = Math.min(18, +(e.MINUTOS || 14)) * 60000;
  const salida = path.join(raiz, 'public', 'semillas-afinadas.json'), avance = path.join(aqui, 'afinar-avance.txt');
  let w = Float32Array.from(sv[ESP].pesos), gen = 0; if (w.length !== m.N_PESOS_G) { console.log(`la red de ${ESP} no tiene la forma de ahora (${w.length} en vez de ${m.N_PESOS_G}): hay que volver a correr imitar.mjs`); process.exit(1); }
  // PARA QUE PUEDA DESCUBRIR «construir»: el maestro no lo hizo nunca, asi que la red que lo imita lo trae sin decidir (pesos en cero). Con eso no lo
  // probaria jamas y no habria nada que aprender. Se le dan pesos chicos al azar y ganas apenas por debajo de «nada»: lo prueba de vez en cuando, en
  // situaciones cualesquiera, y el entrenamiento decide si le sirve, cuando, o si lo apaga
  { const O = 24, nSal = 2 + m.N_ACC_G, iWo = m.N_ENT_G * O + O * O + O, iBo = iWo + O * nSal, k = 2 + m.ACC.construir; let cero = true; for (let j = 0; j < O; j++) if (w[iWo + k * O + j] !== 0) cero = false;
    if (cero) { const g = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); }; for (let j = 0; j < O; j++) w[iWo + k * O + j] = g() * 0.35; w[iBo + k] = w[iBo + 2] - 0.4; } }
  const obreros = Array.from({length: HILOS}, () => new Worker(new URL(import.meta.url), {workerData: {esp: ESP}})), espera = new Map(); let nId = 0, turno = 0;
  for (const o of obreros) o.on('message', ({id, r}) => { espera.get(id)(r); espera.delete(id); });
  const pedir = (ww, semilla) => new Promise(ok => { const id = nId++; espera.set(id, ok); obreros[turno++ % HILOS].postMessage({id, w: ww, semilla}); });
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); };
  const linea = t => { console.log(t); fs.appendFileSync(avance, t + '\n'); };
  fs.writeFileSync(avance, ''); linea(`${ESP}: ${w.length} pesos, desde la red que imita al maestro · ${POB} pares x ${MUNDOS} mundos de ${DIAS} dias (lado ${m.L} m), ${HILOS} hilos, hasta ${Math.round(TOPE / 60000)} minutos`);
  const t0 = Date.now(); let tGen = 0;
  while (Date.now() - t0 + tGen * 1.2 < TOPE) { const tg = Date.now(); gen++;
    const eps = [], tareas = [];
    for (let i = 0; i < POB; i++) { const en = Float32Array.from({length: w.length}, gauss); eps.push(en);   // (de a pares, +e y -e, en los MISMOS mundos: lo que cambia es la red, no la suerte)
      for (const sg of [1, -1]) { const c = new Float32Array(w.length); for (let k = 0; k < c.length; k++) c[k] = w[k] + sg * SIGMA * en[k]; tareas.push(pedir(c, gen)); } }
    tareas.push(pedir(w, gen)); const rs = await Promise.all(tareas), centro = rs.pop(), fs_ = rs.map(r => r.f);
    const orden = fs_.map((f, i) => [f, i]).sort((a, b) => a[0] - b[0]), rango = new Float32Array(fs_.length); orden.forEach(([, i], r) => { rango[i] = r / (fs_.length - 1) - 0.5; });   // (por rangos: un mundo con suerte no arrastra todo)
    for (let i = 0; i < POB; i++) { const dif = rango[2 * i] - rango[2 * i + 1], en = eps[i]; for (let k = 0; k < w.length; k++) w[k] += PASO / POB * dif * en[k]; }
    const med = a => rs.reduce((s, r) => s + r[a], 0) / rs.length;
    linea(`gen ${gen} · bienestar: la red ${centro.f.toFixed(3)}, la poblacion ${med('f').toFixed(3)}, la mejor ${Math.max(...fs_).toFixed(3)} · de noche bajo techo: la red ${Math.round(centro.techo * 100)} %, la poblacion ${Math.round(med('techo') * 100)} % · refugios por mundo: la red ${centro.refugios.toFixed(1)}, la poblacion ${med('refugios').toFixed(1)} (junto a otro ${Math.round(med('junto') * 100)} %) · ${Math.round((Date.now() - t0) / 1000)} s`);
    const sal = {...sv, afinada: {especie: ESP, generaciones: gen, dias: DIAS, lado: m.L, bienestar: +centro.f.toFixed(4), bajoTecho: +centro.techo.toFixed(3), refugios: +centro.refugios.toFixed(1), hecho: new Date().toISOString()}};
    sal[ESP] = {...sv[ESP], pesos: Array.from(w, v => Math.round(v * 1e5) / 1e5)}; fs.writeFileSync(salida, JSON.stringify(sal)); tGen = Date.now() - tg; }
  for (const o of obreros) o.terminate();
}
