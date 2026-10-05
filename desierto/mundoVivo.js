// EL DESIERTO VIVO, SIN GRAFICOS (04-10). Todo lo que vive, en un solo archivo sin THREE ni DOM: corre igual en Node
// (tools/vivo/correr.mjs), en el visor (vivo.html) y como FONDO del juego (steves.js). Las reglas son las del campo
// (Bibites, JaxLife, Primordia):
//  1. NO SE TERMINA: no hay vidas de prueba. El mundo sigue.
//  2. NADIE PONE PUNTAJE: el que come y no se muere, tiene crias; la cria hereda la red del padre con mutacion.
//  3. NO HAY TOPES: las matas viven del agua (floraViva.js), los que comen matas viven de las matas, y los que comen
//     carne, de ellos.
// LA RECETA: todo numero de las reglas esta en M.R, la receta de ESE mundo (ver recetaBase): quien come que y cuanto lo
// llena, hambre, sed, cria, velocidad, mordida, el agua de las matas. Se cambia con el mundo andando (despues, ajustar(M)).
//
// QUE SIENTE Y QUE PUEDE HACER CADA UNO (eso es lo que hace distinta a una red de otra; el tamaño es lo de menos):
//  - LA MATA (floraViva.js): siente el agua, si la comen, si esta apretada. Reparte su energia: crecer, hojas, semillas, reserva.
//  - EL ANIMAL (cerdo, coyote): su cuerpo + 8 direcciones x 6 canales (comida, agua, peligro, gente, gigante, los suyos).
//    Gira, avanza, y elige entre nada / echarse / llamar / embestir-morder. Elman 57 -> 24 -> 2 + 4.
//  - LA GENTE (steve, arana) (07-10, Fabri: "la guerra no es parte de la red, suena muy hardcodeado"): YA NO HAY MENU ni
//    tareas escritas (ni consejo, ni "guerra", ni "partida de caza"). Su red les maneja el cuerpo como a un animal, y
//    tienen mas PIEZAS: lo que salga de combinarlas -cazar juntos, guardar comida, robarle a la vecina, pelear- sale, o
//    no sale. Elman 72 -> 24 -> 2 + 10. Sienten lo del animal, mas: lo que llevan, donde queda su casa y cuanto hay en la
//    despensa, las dos señales, si el de al lado tiene hambre, si le dieron, si lo atacaron; y las arañas, su rastro y su tela.
//      el STEVE (manos, voz, aprender de otros): DAR comida al de al lado · AGARRAR y SOLTAR (en casa, va a la despensa:
//        una pila de comida que cualquiera ve... y puede robar) · dos SEÑALES distintas (lo que quieran decir, lo decide
//        la evolucion) · IMITAR: copiar en vida un poco de la red de uno de los suyos al que le va mejor (cultura)
//      la ARAÑA (trampas, rastros y numero): DAR · TEJER una tela que frena al que pasa · dejar RASTRO en el suelo, que
//        las suyas sienten · muchas crias baratas (su receta)
//    Los dos pueden ATACAR lo que tienen enfrente: su presa, o gente de otra tribu.
// LO QUE SIGUE SIENDO REGLA, declarado: los reflejos a pocos metros (el que es presa encara; el que caza, con hambre y la
// presa a 12 m, se le tira encima), comer y tomar cuando esta encima de la comida o el agua, el aljibe del campamento,
// y el gigante (camina y pisa).
import {crearRed, nPesos, OCULTAS} from './red2.js';
import * as flora from './floraViva.js';
import * as tribu from './tribuViva.js';

const amb = (k, d) => +((globalThis.__vivoCfg?.[k] ?? (typeof process !== 'undefined' && process.env[k])) || d);   // (del entorno en Node, de globalThis.__vivoCfg en el navegador)
// (el lado del mundo, en metros -se cierra sobre si mismo-; multiplo de 150)
export const L = amb('L', 600), CELDA = 150, DIA = 1200, SECT = 8, N_ENT = 9 + SECT * 6, N_ACC = 4;
export const N_ENT_G = N_ENT + 15, N_ACC_G = 10, N_PESOS_G = nPesos(N_ENT_G, N_ACC_G);   // la gente: 15 sentidos y 6 acciones mas
export const ANIMALES = ['cerdo', 'coyote'], TRIBALES = ['steve', 'arana'], ESPECIES = [...ANIMALES, ...TRIBALES], COMIDAS = ['pasto', 'carne', ...ESPECIES];
// las acciones de la gente (el numero es la salida de la red)
export const ACC = {nada: 0, echarse: 1, senalA: 2, atacar: 3, senalB: 4, dar: 5, agarrar: 6, soltar: 7, tejer: 8, rastro: 9};
const PUEDE = {steve: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0], arana: [1, 1, 1, 1, 1, 1, 0, 0, 1, 1]};   // (el Steve tiene manos; la araña, tela y rastro)
// lo que NO es de la receta (la forma del cuerpo): giro en rad/s, hasta donde ve cada canal [comida, agua, peligro, gente, gigante, los suyos], el arranque de la embestida
const FIJO = {cerdo: {giro: 2.6, vista: [40, 350, 60, 60, 200, 50], embiste: 5.5}, coyote: {giro: 3.2, vista: [80, 350, 60, 60, 200, 60], embiste: 8},
  steve: {giro: 3.0, vista: [60, 350, 60, 80, 200, 60], embiste: 6.5}, arana: {giro: 3.4, vista: [60, 350, 60, 80, 200, 60], embiste: 7.5}};

// ---------- LA RECETA ----------
// come[quien][que]: para 'pasto' y 'carne', cuanto le baja el hambre cada unidad que come (0 = no lo come). Para una
//   especie, mas de 0 = LA CAZA (la mata para comer); lo que llena es la carne que deja.
// esp[...]: v = velocidad maxima (m/s); tHambre / tSed = segundos de 0 a 1; gesta = segundos de buena vida para una cria;
//   vida = segundos hasta la vejez; mordida = salud que saca un golpe; carne = cuanta carne deja al morir;
//   hambreCaza = con cuanta hambre sale a cazar (0.25 = casi siempre; 0.6 = solo con hambre de verdad).
//   (cria y alcance: solo los usa el juego, que todavia mueve a sus tribus con el sistema viejo)
// flora: agua = la que hay por celda de 150 m; ritmo = que tan rapido crece todo; lluvia = cuanto mas rinde lloviendo;
//   resto = la parte de la mata que no se alcanza a comer; bocas = cuantos comen a la vez de una mata comun.
// costoTam: cuanto mas gasta el grande (exponente del metabolismo; 0.75 = Kleiber). pudre: segundos que dura la carne tirada.
// olfatoAgua: desde cuantos metros saben donde hay agua.
export function recetaBase() {
  return {
    come: {
      cerdo:  {pasto: 1.6, carne: 0,   cerdo: 0, coyote: 0, steve: 0, arana: 0},
      coyote: {pasto: 0,   carne: 2.5, cerdo: 1, coyote: 0, steve: 0, arana: 0},
      steve:  {pasto: 0.8, carne: 2.5, cerdo: 1, coyote: 0, steve: 0, arana: 0},   // (los Steves tambien comen pasto)
      arana:  {pasto: 0,   carne: 2.5, cerdo: 1, coyote: 0, steve: 1, arana: 0},   // (las arañas cazan Steves)
    },
    esp: {
      cerdo:  {v: 4.6, tHambre: 600,  tSed: 400,  gesta: 900,  vida: 4 * 3600, mordida: 0,   carne: 1,   hambreCaza: 0.25},
      coyote: {v: 7.5, tHambre: 900,  tSed: 500,  gesta: 2400, vida: 5 * 3600, mordida: 0.5, carne: 0.4, hambreCaza: 0.25},
      steve:  {v: 5.6, tHambre: 1500, tSed: 1200, gesta: 1500, vida: 6 * 3600, mordida: 0.4, carne: 0.6, hambreCaza: 0.25, cria: 150, alcance: 1.3},
      arana:  {v: 6.5, tHambre: 1200, tSed: 1000, gesta: 500,  vida: 3 * 3600, mordida: 0.5, carne: 0.3, hambreCaza: 0.25, cria: 60,  alcance: 1.7},
    },
    flora: {agua: 30, ritmo: 1, lluvia: 1.4, resto: 0.15, bocas: 3},
    costoTam: 0.75, pudre: 900, olfatoAgua: 350,
  };
}
// mezcla una receta parcial (solo lo que cambia) sobre otra; ignora lo que no existe en la base
export function mezclar(base, parcial) { if (parcial) for (const k in parcial) { if (!(k in base)) continue; if (base[k] && typeof base[k] === 'object') mezclar(base[k], parcial[k]); else if (typeof parcial[k] === 'number' && isFinite(parcial[k])) base[k] = parcial[k]; } return base; }
// lo que cambia de una receta respecto de la base (para guardarla corta, o pasarla por link)
export function diferencia(Rc, base = recetaBase()) { const o = {}; for (const k in base) { if (base[k] && typeof base[k] === 'object') { const d = diferencia(Rc[k] || {}, base[k]); if (Object.keys(d).length) o[k] = d; } else if (Rc[k] !== base[k] && typeof Rc[k] === 'number') o[k] = Rc[k]; } return o; }
// despues de tocar la receta de un mundo: quien caza a quien
export function ajustar(M) { const Rc = M.R; M.caza = {}; M.loCazan = {}; M.genteLoCaza = {};
  for (const k of ESPECIES) { M.caza[k] = ESPECIES.filter(o => Rc.come[k][o] > 0); M.loCazan[k] = ANIMALES.filter(o => Rc.come[o][k] > 0); M.genteLoCaza[k] = TRIBALES.filter(o => Rc.come[o][k] > 0); }
  return M; }

const R = Math.random, TAU = 6.2832;
const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
const env = d => d - L * Math.round(d / L), dif = (a, b) => [env(b.x - a.x), env(b.z - a.z)], dist = (a, b) => Math.hypot(env(b.x - a.x), env(b.z - a.z));
const ang = a => Math.atan2(Math.sin(a), Math.cos(a)), envolver = v => ((v % L) + L) % L, lim = v => Math.max(-1, Math.min(1, v));
const mover = (e, dt) => { e.x = envolver(e.x + Math.sin(e.rumbo) * e.v * dt); e.z = envolver(e.z + Math.cos(e.rumbo) * e.v * dt); };
export const noche = M => 0.5 + 0.5 * Math.cos(((M.t % DIA) / DIA) * TAU);
const deFrente = (P, Q) => { const [dx, dz] = dif(P, Q), d = Math.hypot(dx, dz) || 1; return (dx * Math.sin(P.rumbo) + dz * Math.cos(P.rumbo)) / d > 0.5 && P.v < 2; };
export const comible = (M, p) => p.comida - M.R.flora.resto * (p.tam || 1);   // lo que se le puede sacar a una mata (el resto no se alcanza: Noy-Meir 1975)

// ---------- LA HERENCIA ----------
export const MUT = {prob: 0.1, sigma: 0.08};
export function pesosHijos(w) { const h = Float32Array.from(w); for (let i = 0; i < h.length; i++) if (R() < MUT.prob) h[i] += gauss() * MUT.sigma; return h; }
// el hijo de DOS (la gente): cada peso, de uno de los dos; uno de cada diez, corrido un poco
export function cruzar(a, b) { const h = new Float32Array(a.length); for (let i = 0; i < h.length; i++) { h[i] = b && R() < 0.5 ? b[i] : a[i]; if (R() < MUT.prob) h[i] += gauss() * MUT.sigma; } return h; }
const tamHijo = t => Math.max(0.6, Math.min(2.2, t + gauss() * 0.04));
const genNuevo = () => ({crece: 0.8 + R() * 0.4, sequia: R() * 0.3, fibra: R() * 0.3, espina: R() * 0.25, dispersa: 0.3 + R() * 0.4});
const genHijo = g => { const m = x => Math.min(1, Math.max(0, x + (R() - 0.5) * 0.1)); return {crece: Math.min(1.6, Math.max(0.5, g.crece + (R() - 0.5) * 0.1)), sequia: m(g.sequia), fibra: m(g.fibra), espina: m(g.espina), dispersa: m(g.dispersa)}; };
// LA SEMILLA DE LA GENTE: la red de un animal ya entrenado (la de Cresta salvaje: sabe ir a la comida y al agua, y echarse),
// agrandada: los 15 sentidos nuevos arrancan sin peso, y las 6 acciones nuevas, con pesos chicos al azar y pocas ganas
// (salen de vez en cuando: lo justo para que la seleccion tenga de donde agarrarse). Nada de eso esta entrenado.
export function semillaGente(w57) {
  const w = new Float32Array(N_PESOS_G), O = OCULTAS, n0 = N_ENT, n1 = N_ENT_G, s0 = 2 + N_ACC, s1 = 2 + N_ACC_G;
  const iWh0 = n0 * O, iB0 = iWh0 + O * O, iWo0 = iB0 + O, iBo0 = iWo0 + O * s0, iWh1 = n1 * O, iB1 = iWh1 + O * O, iWo1 = iB1 + O, iBo1 = iWo1 + O * s1;
  for (let j = 0; j < O; j++) for (let i = 0; i < n0; i++) w[j * n1 + i] = w57[j * n0 + i];
  for (let i = 0; i < O * O + O; i++) w[iWh1 + i] = w57[iWh0 + i];
  let piso = 1e9; for (let k = 2; k < s0; k++) piso = Math.min(piso, w57[iBo0 + k]);
  for (let k = 0; k < s1; k++) { if (k < s0) { for (let j = 0; j < O; j++) w[iWo1 + k * O + j] = w57[iWo0 + k * O + j]; w[iBo1 + k] = w57[iBo0 + k]; }
    else { for (let j = 0; j < O; j++) w[iWo1 + k * O + j] = gauss() * 0.15; w[iBo1 + k] = piso + 0.1 + gauss() * 0.3; } }
  return w;
}

// ---------- NACER ----------
function nacer(M, esp, x, z, w, tam, madre, de) {
  const A = {id: M.nId++, esp, F: FIJO[esp], x: envolver(x), z: envolver(z), rumbo: R() * TAU, v: 0, vivo: true, hambre: madre ? 0.45 : 0.2 + R() * 0.3, sed: madre ? 0.4 : 0.2 + R() * 0.3, cansancio: 0.2, salud: 1,
    tEmb: 0, tSusto: 0, susDe: null, tDec: R() * 0.5, accion: 0, o: {giro: 0, vel: 0, accion: 0}, w, tam, edad: madre ? 0 : 600 + R() * 1200, cria: 0, gen: madre ? madre.gen + 1 : 0, hijos: 0, presas: 0, que: 'anda', ...de,
    red: crearRed(w, N_ENT, N_ACC)};
  A.red.reiniciar(); M.pob[esp].push(A); if (madre) M.cuenta.nacen[esp] = (M.cuenta.nacen[esp] || 0) + 1; return A;
}
// uno de una tribu. o: {x, z, w (su red; si falta o es de otra forma, la semilla), gen, edad, hambre..., imita, lleva, padres,
//   cerebro y ficha: lo que el JUEGO sabe de el (su red de decidir vieja, su aspecto): aca no se usan, se llevan y se devuelven}
function nuevaGente(M, K, o = {}) {
  const w = o.w && o.w.length === N_PESOS_G ? (o.w instanceof Float32Array ? o.w : Float32Array.from(o.w)) : pesosHijos(M.semillaG);
  const s = {id: M.nId++, K, esp: K.esp, F: FIJO[K.esp], x: envolver(o.x ?? K.x + (R() - 0.5) * 8), z: envolver(o.z ?? K.z + (R() - 0.5) * 8), rumbo: R() * TAU, v: 0, vivo: true, tam: 1,
    hambre: o.hambre ?? 0.15 + R() * 0.3, sed: o.sed ?? 0.15 + R() * 0.3, cansancio: o.cansancio ?? 0.2, salud: o.salud ?? 1, tEmb: 0, tSusto: 0, susDe: null, tDec: R() * 0.5, accion: 0, o: {giro: 0, vel: 0, accion: 0},
    w, red: crearRed(w, N_ENT_G, N_ACC_G), edad: o.edad ?? 1000, cria: o.cria || 0, gen: o.gen || 0, hijos: 0, presas: 0, que: 'anda', lleva: o.lleva || 0, imita: o.imita ?? 0.3 + R() * 0.4, tImita: R() * 60,
    padres: o.padres || null, cerebro: o.cerebro || null, ficha: o.ficha || null, caza: false, meDieron: 0, meAtaco: 0, tHace: 0, oye: null, mate: null, atrapado: 0};
  s.red.reiniciar(); K.gen = Math.max(K.gen, s.gen); K.miembros.push(s); return s;
}
function pila(M, K) { const p = {x: K.x, z: K.z, K, fija: true}; Object.defineProperty(p, 'carne', {get: () => K.comida * 3, set: v => { K.comida = Math.max(0, Math.min(1, v / 3)); }}); M.cuerpos.push(p); K.pila = p; return K; }   // LA DESPENSA: una pila de comida en el campamento (llena = 3 de carne). Cualquiera la ve y come de ella
function campo(M, o) { const K = {id: M.nId++, x: envolver(o.x), z: envolver(o.z), miembros: [], esp: o.esp, estetica: o.estetica ?? null, agresiva: !!o.agresiva, comida: o.comida ?? 0.3, rencor: new Map(), pisadas: o.pisadas || 0, rencorGig: o.rencorGig || 0, gen: o.gen || 0, plId: o.plId, cultura: o.cultura || null, enJuego: !!o.enJuego, consigna: null, tarea: null}; M.tribus.push(K); return pila(M, K); }
// PONER una tribu que viene de otro lado (el juego: un campamento en una ruina); su gente, con ponerGente
export function ponerTribu(M, o) { return campo(M, o); }
export function ponerGente(M, K, lista) { for (const e of lista) { const s = nuevaGente(M, K, {...e, x: undefined, z: undefined}); if (e.hijoDeDos) s.padres = [0, 0]; } return K; }
function poblarTribu(M, K, esp) { K.esp = esp; K.estetica = esp === 'arana' ? null : ['hippie', 'punk', 'cyber'][Math.floor(R() * 3)]; K.agresiva = R() < 0.4; K.comida = 0.4; K.gen = 0;
  for (let i = 0, n = esp === 'arana' ? 9 : 6; i < n; i++) nuevaGente(M, K, {cerebro: M.semillaTribu ? tribu.variar(M.semillaTribu) : null}); }
function mundoVacio(o) {
  const M = {t: 0, nId: 1, R: mezclar(recetaBase(), o.receta), oasis: [], celdas: new Map(), pob: {}, steves: [], porEsp: {steve: [], arana: []}, tribus: [], cuerpos: [], telas: [], rastros: [], gigante: null, semillas: o.semillas, semillaTribu: o.semillaTribu, banco: {}, quiere: {},
    semillaG: o.semillas?.cerdo ? semillaGente(o.semillas.cerdo) : null, cuenta: {nacen: {}, nacenMatas: 0, muertes: {}, llegadas: {}, hizo: {}}};
  for (const k of ANIMALES) { M.pob[k] = []; M.banco[k] = []; }
  const N = L / CELDA; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) M.celdas.set(i + ',' + j, []);
  return ajustar(M);
}
// opciones: {receta (parcial), semillas: {cerdo: pesos, coyote: pesos}, semillaTribu: pesos, n: {cerdo, coyote}, tribus: {steve, arana}, nOasis, gigante,
//   oasis: [{x, z, R}] (los oasis, ya puestos: los del juego), pozo: {cerdo: [{w, tam, gen}], coyote: [...]} (de donde sacan su red los primeros)}
export function crearMundo(o = {}) {
  const M = mundoVacio(o);
  if (o.oasis) for (const q of o.oasis) M.oasis.push({x: envolver(q.x), z: envolver(q.z), R: q.R}); else for (let i = 0; i < (o.nOasis ?? 3); i++) M.oasis.push({x: R() * L, z: R() * L, R: 4 + R() * 3});
  for (const [id, l] of M.celdas) { const [i, j] = id.split(',').map(Number); if (R() < 0.7) l.push({x: (i + R()) * CELDA, z: (j + R()) * CELDA, comida: 0.5 + R() * 0.5, R: 3, g: genNuevo()}); }
  for (const oa of M.oasis) for (let k = 0; k < 10; k++) { const a = R() * TAU, d = oa.R + 4 + R() * 45, x = envolver(oa.x + Math.cos(a) * d), z = envolver(oa.z + Math.sin(a) * d); celdaDe(M, x, z).push({x, z, comida: 0.4 + R() * 0.6, R: 3, g: genNuevo()}); }
  for (const k of ANIMALES) { const n = o.n?.[k] ?? 0; M.quiere[k] = n > 0; for (let i = 0; i < n; i++) { const oa = M.oasis.length ? M.oasis[i % M.oasis.length] : {x: R() * L, z: R() * L}, p = o.pozo?.[k]?.length ? o.pozo[k][i % o.pozo[k].length] : null;
      nacer(M, k, oa.x + (R() - 0.5) * 80, oa.z + (R() - 0.5) * 80, Float32Array.from(p ? p.w : o.semillas[k]), p ? p.tam : 1, null, p ? {gen: p.gen || 0} : null); } }
  if (o.gigante) M.gigante = {x: R() * L, z: R() * L, rumbo: R() * TAU, tGiro: 200, tPaso: 0, lado: 1, v: 3};
  if (M.semillaG) for (const esp of TRIBALES) for (let k = 0; k < (o.tribus?.[esp] ?? 0); k++) { const oa = M.oasis.length ? M.oasis[Math.floor(R() * M.oasis.length)] : null, a = R() * TAU, d = 60 + R() * 160;   // (los campamentos, a la vista de un oasis)
      poblarTribu(M, campo(M, {x: oa ? oa.x + Math.cos(a) * d : R() * L, z: oa ? oa.z + Math.sin(a) * d : R() * L, esp}), esp); }
  return M;
}
// METER un animal que viene de otro lado (del juego, cuando sale de la burbuja del jugador): con su red y su cuerpo tal cual
export function meter(M, esp, e) { return nacer(M, esp, e.x, e.z, e.w, e.tam ?? 1, null, {rumbo: e.rumbo ?? R() * TAU, edad: e.edad ?? 1000, gen: e.gen || 0, cria: e.cria || 0, hambre: e.hambre ?? 0.3, sed: e.sed ?? 0.3, cansancio: e.cansancio ?? 0.2, salud: e.salud ?? 1}); }
const celdaDe = (M, x, z) => M.celdas.get(Math.floor(envolver(x) / CELDA) + ',' + Math.floor(envolver(z) / CELDA));
export function aguaDe(M, x, z) { let d = 1e9; for (const o of M.oasis) d = Math.min(d, Math.hypot(env(o.x - x), env(o.z - z)) - o.R); return 0.28 + 0.72 * Math.exp(-Math.max(0, d) / 60); }
function matasCerca(M, x, z, max, cb) { const N = L / CELDA, i0 = Math.floor((x - max) / CELDA), i1 = Math.floor((x + max) / CELDA), j0 = Math.floor((z - max) / CELDA), j1 = Math.floor((z + max) / CELDA);
  if (i1 - i0 + 1 >= N && j1 - j0 + 1 >= N) { for (const l of M.celdas.values()) for (const p of l) cb(p); return; }
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = M.celdas.get(((i % N) + N) % N + ',' + ((j % N) + N) % N); if (l) for (const p of l) cb(p); } }
// LA REJILLA DE LA GENTE: con cientos de Steves y arañas, que cada uno mire a todos los demas es lo que mas cuesta. Se los reparte
// en casilleros de ~90 m (una vez por paso) y cada uno mira solo los de alrededor. genteCerca llama cb(q) con los que PUEDEN estar a
// menos de r (el que llama mide la distancia de verdad)
const NR = Math.max(1, Math.floor(L / 90)), TR = L / NR;
function armarRejilla(M) { const g = M.rej || (M.rej = Array.from({length: NR * NR}, () => [])); for (const c of g) c.length = 0; for (const s of M.steves) g[Math.min(NR - 1, Math.floor(s.x / TR)) + NR * Math.min(NR - 1, Math.floor(s.z / TR))].push(s); }
function genteCerca(M, x, z, r, cb) { const k = Math.ceil(r / TR); if (2 * k + 1 >= NR) { for (const s of M.steves) cb(s); return; } const ci = Math.floor(x / TR), cj = Math.floor(z / TR), g = M.rej;
  for (let j = cj - k; j <= cj + k; j++) for (let i = ci - k; i <= ci + k; i++) { const l = g[((i % NR) + NR) % NR + NR * (((j % NR) + NR) % NR)]; for (let n = 0; n < l.length; n++) cb(l[n]); } }
// los de una especie que pueden estar a menos de r (los animales son pocos: todos; la gente, por la rejilla)
function cercaDe(M, k, x, z, r, cb) { const l = M.pob[k]; if (l) { for (let n = 0; n < l.length; n++) cb(l[n]); return; } genteCerca(M, x, z, r, q => { if (q.esp === k) cb(q); }); }
// los vivos de una especie (animal o gente)
const losDe = (M, k) => M.pob[k] || M.porEsp[k];
const hizo = (M, A, que) => { const k = A.esp + ': ' + que; M.cuenta.hizo[k] = (M.cuenta.hizo[k] || 0) + 1; };
function morir(M, A, causa, carne) { if (!A.vivo) return; A.vivo = false; A.muerte = causa; const k = A.esp + ': ' + causa; M.cuenta.muertes[k] = (M.cuenta.muertes[k] || 0) + 1;
  const c = (carne ?? M.R.esp[A.esp].carne) * (A.tam || 1) + (A.lleva || 0); if (c > 0) M.cuerpos.push({x: A.x, z: A.z, carne: c}); }
const matar = morir;

function marcarEn(out, base, P, e, Rm) { const [dx, dz] = dif(P, e), d = Math.hypot(dx, dz); if (d > Rm || d < 1e-3) return;
  const s = Math.floor(((ang(Math.atan2(dx, dz) - P.rumbo) + Math.PI) / TAU) * SECT) % SECT, k = base + s; out[k] = Math.max(out[k], 1 - d / Rm); }
const _x = new Float32Array(N_ENT), _xg = new Float32Array(N_ENT_G);
const enAgua = (M, A) => M.oasis.some(q => dist(A, q) < q.R + 1.5);
// LOS SENTIDOS, iguales para todos los animales: su cuerpo (9) + 8 direcciones x 6 canales: comida, agua, peligro, gente, gigante, los suyos
function sentir(M, A) {
  const x = _x, V = A.F.vista, C = M.R.come[A.esp]; x.fill(0); x[0] = A.hambre; x[1] = A.sed; x[2] = A.cansancio; x[3] = A.salud;
  x[4] = enAgua(M, A) ? 1 : 0; A.hayCarne = false;
  if (C.pasto > 0) matasCerca(M, A.x, A.z, V[0], p => { const c = comible(M, p); if (c > 0.15 && dist(A, p) < p.R) x[5] = 1; if (c > 0.2) marcarEn(x, 9, A, p, V[0]); });
  if (C.carne > 0) for (const c of M.cuerpos) if (c.carne > 0.05) { const d = dist(A, c); if (d < 2) x[5] = 1; if (d < 30) A.hayCarne = true; marcarEn(x, 9, A, c, V[0]); }
  if (!A.hayCarne) for (const k of M.caza[A.esp]) cercaDe(M, k, A.x, A.z, V[0], q => { if (q.vivo && q !== A) marcarEn(x, 9, A, q, V[0]); });   /* (las presas vivas, salvo que ya tenga carne al lado: con comida servida no sale a matar otra) */
  const h = (M.t % DIA) / DIA * TAU; x[6] = Math.sin(h); x[7] = Math.cos(h); x[8] = A.v / M.R.esp[A.esp].v;
  for (const o of M.oasis) marcarEn(x, 9 + 8, A, o, M.R.olfatoAgua);
  for (const k of M.loCazan[A.esp]) for (const q of M.pob[k]) if (q.vivo && q !== A) marcarEn(x, 9 + 16, A, q, V[2]);
  genteCerca(M, A.x, A.z, V[3], s => marcarEn(x, 9 + 24, A, s, V[3]));
  if (M.gigante) marcarEn(x, 9 + 32, A, M.gigante, V[4]);
  for (const q of M.pob[A.esp]) if (q.vivo && q !== A) marcarEn(x, 9 + 40, A, q, V[5]);
  if (A.llamado && A.llamado.t > 0) { const [dx, dz] = dif(A, A.llamado), sct = Math.floor(((ang(Math.atan2(dx, dz) - A.rumbo) + Math.PI) / TAU) * SECT) % SECT; x[9 + 40 + sct] = 1; }
  return x;
}
// LOS REFLEJOS (innatos, no son red; mandan solo a pocos metros):
//  - el embestido: huye 6 segundos
//  - la presa: con uno que se la come a menos de 8 m (o gente que la viene cazando a menos de 6), lo encara quieta y lo embiste si lo tiene a tiro
//  - el cazador: con hambre y una presa a menos de 12 m, se le tira encima y muerde. Llegar hasta ahi es cosa de la red
function reflejo(M, A) {
  if (A.tSusto > 0 && A.susDe) { const [dx, dz] = dif(A.susDe, A); return {giro: lim(ang(Math.atan2(dx, dz) - A.rumbo) * 2), vel: 1, accion: 0}; }
  let cerca = null, dm = 8; for (const k of M.loCazan[A.esp]) for (const y of M.pob[k]) if (y.vivo && y !== A) { const d = dist(A, y); if (d < dm) { dm = d; cerca = y; } }
  if (M.genteLoCaza[A.esp].length) genteCerca(M, A.x, A.z, 8, s => { if (s.caza && s.K !== A.K && !(s.tSusto > 0) && M.R.come[s.esp][A.esp] > 0) { const d = dist(A, s); if (d < Math.min(dm, 6)) { dm = d; cerca = s; } } });
  if (cerca) { const [dx, dz] = dif(A, cerca), a = ang(Math.atan2(dx, dz) - A.rumbo); return {giro: lim(a * 2), vel: 0.05, accion: dm < 3.5 && Math.abs(a) < 0.8 ? 3 : 0}; }
  if (M.caza[A.esp].length && A.hambre > M.R.esp[A.esp].hambreCaza && !A.hayCarne) { let pr = null, dp = 12; for (const k of M.caza[A.esp]) cercaDe(M, k, A.x, A.z, 12, q => { if (q.vivo && q !== A && !(A.K && q.K === A.K)) { const d = dist(A, q); if (d < dp) { dp = d; pr = q; } } });
    if (pr) { const [dx, dz] = dif(A, pr); return {giro: lim(ang(Math.atan2(dx, dz) - A.rumbo) * 2), vel: 1, accion: dp < 1.5 + A.v * 0.1 ? 3 : 0, caza: true}; } }
  return null;
}
// EL GOLPE (la accion 3, "embestir / atacar"): arranca de frente. Al que se lo come, lo asusta; a su presa -y, la gente, a la
// gente de otra tribu- la lastima. La presa que encara frena la mitad; el atrapado en una tela no esquiva nada
function golpe(M, A, E, F) {
  A.tEmb = 1.5; A.v = Math.max(A.v, F.embiste); A.cansancio = Math.min(1, A.cansancio + 0.04);
  const fx = Math.sin(A.rumbo), fz = Math.cos(A.rumbo), alFrente = (q, r) => { const [dx, dz] = dif(A, q), d = Math.hypot(dx, dz); return d < r && dx * fx + dz * fz > 0 && Math.abs(ang(Math.atan2(dx, dz) - A.rumbo)) < 0.8 ? d : 0; };
  let blanco = null, db = 9; for (const k of M.loCazan[A.esp]) for (const y of M.pob[k]) if (y.vivo && y !== A) { const d = alFrente(y, 3.5); if (d && d < db) { db = d; blanco = y; } }
  if (M.genteLoCaza[A.esp].length) genteCerca(M, A.x, A.z, 4, s => { if (s.vivo && s.K !== A.K && s.caza && M.R.come[s.esp][A.esp] > 0) { const d = alFrente(s, 3.5); if (d && d < db) { db = d; blanco = s; } } });
  if (blanco) { blanco.tSusto = 6; blanco.susDe = {x: A.x, z: A.z}; }
  if (!(E.mordida > 0)) return;
  let pr = null, dp = 9; for (const k of M.caza[A.esp]) cercaDe(M, k, A.x, A.z, 3, q => { if (q.vivo && q !== A && !(A.K && q.K === A.K)) { const d = alFrente(q, 2.4); if (d && d < dp) { dp = d; pr = q; } } });
  if (A.K && !pr) genteCerca(M, A.x, A.z, 3, q => { if (q.vivo && q.K !== A.K) { const d = alFrente(q, 2.4); if (d && d < dp) { dp = d; pr = q; } } });   // (la gente: tambien al de otra tribu que tiene enfrente, aunque no sea su comida)
  if (!pr) return; if (A.K) hizo(M, A, pr.K ? 'ataco a gente de otra tribu' : 'ataco a una presa');
  if (!(pr.atrapado > 0) && deFrente(pr, A) && R() < 0.5) return;
  pr.salud -= E.mordida * A.tam / (pr.tam || 1); if (pr.K) pr.meAtaco = 1;
  if (pr.salud <= 0) { matar(M, pr, 'lo mato un ' + A.esp); A.presas++; }
}
// EL CUERPO, el mismo para todos: hambre, sed, cansancio, salud, vejez. Devuelve false si se murio. come / toma: lo que hizo este paso
function cuerpo(M, A, E, dt, a, come, toma) {
  if (a === 1 && A.v < 0.4) { A.cansancio = Math.max(0, A.cansancio - dt * 0.012); if (A.hambre < 0.6 && A.sed < 0.6) A.salud = Math.min(1, A.salud + dt / 300); }
  if (A.hambre >= 1 || A.sed >= 1) A.salud -= dt / 150; if (A.cansancio >= 1) A.salud -= dt / 400;
  if (A.edad > E.vida) A.salud -= dt / 300;
  if (A.salud <= 0) { morir(M, A, A.edad > E.vida ? 'vejez' : A.hambre >= 1 ? 'hambre' : A.sed >= 1 ? 'sed' : A.cansancio >= 1 ? 'agotamiento' : 'heridas'); return false; }
  return true;
}
// comer lo que tiene debajo (la mata, la carne -o la pila de una despensa-). Devuelve true si comio
function comer(M, A, C, dt, ritmo) {
  let come = false;
  if (C.pasto > 0) { let mata = null; matasCerca(M, A.x, A.z, 4, p => { if (!mata && comible(M, p) > 0.05 && dist(A, p) < p.R) mata = p; });
    // EL ESTORBO: alrededor de una mata entran pocas bocas (3 en una comun, mas en una grande); si hay mas, se reparten el lugar
    if (mata) { mata.bocas = (mata.bocas || 0) + 1; const lugar = Math.min(1, M.R.flora.bocas * Math.sqrt(mata.tam || 1) / Math.max(1, mata.bocasAnt || 1));
      const e = 1 - 0.7 * (mata.g?.espina || 0), k = Math.max(0, Math.min(comible(M, mata), dt * 0.03 * ritmo * e * A.tam * lugar)); mata.comida -= k; A.hambre = Math.max(0, A.hambre - k * C.pasto / A.tam); if (k > 0) come = true; } }
  if (C.carne > 0 && !come) { const c = M.cuerpos.find(q => q.carne > 0.001 && dist(q, A) < 2.5); if (c) { const k = Math.min(c.carne, dt * 0.02 * ritmo * A.tam); c.carne -= k; A.hambre = Math.max(0, A.hambre - k * C.carne / A.tam); come = true; if (c.K && A.K && c.K !== A.K) hizo(M, A, 'comio de la despensa de otra tribu'); } }
  return come;
}

// ---------- LA VIDA DE UN ANIMAL ----------
function vivir(M, A, dt) {
  const E = M.R.esp[A.esp], C = M.R.come[A.esp], F = A.F;
  if ((A.tDec -= dt) <= 0) { A.tDec = 0.5; A.o = A.red.paso(sentir(M, A)); }
  const rf = reflejo(M, A); let o = rf || A.o; if (A.atrapado > 0) { A.atrapado -= dt; o = {giro: 0, vel: 0, accion: 0}; }   /* (en una tela: no se mueve) */
  let a = o.accion; if (a === 1 && A.cansancio < 0.25) a = 0; A.accion = a;
  A.rumbo += o.giro * F.giro * dt; A.v += (o.vel * E.v - A.v) * Math.min(1, dt * 3); if (a === 1) A.v *= Math.exp(-dt * 6); if (A.atrapado > 0) A.v = 0;
  if (A.tEmb > 0) A.tEmb -= dt; if (A.tSusto > 0) A.tSusto -= dt;
  if (a === 3 && A.tEmb <= 0) golpe(M, A, E, F);
  mover(A, dt);
  if (a === 2) for (const q of M.pob[A.esp]) if (q.vivo && q !== A && dist(q, A) < 45) q.llamado = {x: A.x, z: A.z, t: 3};
  if (A.llamado) A.llamado.t -= dt;
  const ritmo = A.v < 0.6 ? 1 : 0.3, gasto = Math.pow(A.tam, M.R.costoTam); A.edad += dt;
  A.hambre = Math.min(1, A.hambre + dt / E.tHambre * gasto); A.sed = Math.min(1, A.sed + dt / E.tSed * gasto); A.cansancio = Math.min(1, Math.max(0, A.cansancio + dt * (0.0006 + 0.005 * (A.v / E.v) ** 2)));
  const come = A.hambre > 0.05 && comer(M, A, C, dt, ritmo);
  let toma = false; if (A.sed > 0.03 && enAgua(M, A)) { A.sed = Math.max(0, A.sed - dt * 0.08 * ritmo); toma = true; }
  A.que = A.atrapado > 0 ? 'atrapado' : A.tSusto > 0 ? 'huye' : A.tEmb > 1 ? (M.caza[A.esp].length ? 'muerde' : 'embiste') : rf && rf.caza ? 'caza' : rf ? 'encara' : come && A.v < 0.6 ? 'come' : toma && A.v < 0.6 ? 'toma' : a === 1 && A.v < 0.4 ? 'echado' : a === 2 ? 'llama' : A.v > 0.7 * E.v ? 'corre' : 'anda';
  if (!cuerpo(M, A, E, dt, a)) return;
  // LA CRIA: adulto, comido, tomado y sano, va juntando; cuando junta, nace uno al lado con su red, mutada
  if (A.edad > 600 && A.hambre < 0.4 && A.sed < 0.5 && A.salud > 0.8) { A.cria += dt / E.gesta;
    if (A.cria >= 1) { A.cria = 0; A.hambre = Math.min(1, A.hambre + 0.3); A.hijos++; nacer(M, A.esp, A.x + (R() - 0.5) * 3, A.z + (R() - 0.5) * 3, pesosHijos(A.w), tamHijo(A.tam), A);
      const b = M.banco[A.esp]; b.push({w: A.w, tam: A.tam}); if (b.length > 8) b.shift(); } }
}

// ---------- LA VIDA DE UNO DE UNA TRIBU (Steve o araña): su red le maneja el cuerpo, como a un animal, con mas piezas ----------
// LOS SENTIDOS: los 57 del animal (comida segun su receta; en "peligro", los animales y la gente que se lo come; en "gente", los
// de OTRA tribu; en "los suyos", los de la suya) y 15 mas:
//   57 cuanto lleva en las manos · 58 esta en casa · 59-60 para donde queda la casa · 61 cuanto hay en la despensa
//   62-63 la señal A que oye (fuerza, de que lado) · 64-65 la señal B · 66 el hambre del de los suyos que tiene al lado
//   67 le dieron hace poco · 68 lo ataco uno de otra tribu hace poco
//   69-70 el rastro de las suyas adelante a la izquierda / a la derecha · 71 hay algo atrapado en una tela de las suyas
function sentirGente(M, A) {
  const x = _xg, V = A.F.vista, C = M.R.come[A.esp], K = A.K; x.fill(0); x[0] = A.hambre; x[1] = A.sed; x[2] = A.cansancio; x[3] = A.salud;
  const dCasa = dist(A, K); x[4] = dCasa < 3.5 || enAgua(M, A) ? 1 : 0; A.hayCarne = false;   // (el aljibe del campamento tambien es agua)
  if (C.pasto > 0) matasCerca(M, A.x, A.z, V[0], p => { const c = comible(M, p); if (c > 0.15 && dist(A, p) < p.R) x[5] = 1; if (c > 0.2) marcarEn(x, 9, A, p, V[0]); });
  if (C.carne > 0) for (const c of M.cuerpos) if (c.carne > 0.05) { const d = dist(A, c); if (d < 2.5) x[5] = 1; if (d < 30) A.hayCarne = true; marcarEn(x, 9, A, c, V[0]); }
  if (!A.hayCarne) for (const k of M.caza[A.esp]) cercaDe(M, k, A.x, A.z, V[0], q => { if (q.vivo && q.K !== K) marcarEn(x, 9, A, q, V[0]); });
  const h = (M.t % DIA) / DIA * TAU; x[6] = Math.sin(h); x[7] = Math.cos(h); x[8] = A.v / M.R.esp[A.esp].v;
  for (const o of M.oasis) marcarEn(x, 9 + 8, A, o, M.R.olfatoAgua); marcarEn(x, 9 + 8, A, K, M.R.olfatoAgua);
  for (const k of M.loCazan[A.esp]) for (const q of M.pob[k]) if (q.vivo) marcarEn(x, 9 + 16, A, q, V[2]);
  let mate = null, dm = 6;
  genteCerca(M, A.x, A.z, V[3], q => { if (q === A || !q.vivo) return; if (q.K === K) { marcarEn(x, 9 + 40, A, q, V[5]); const d = dist(A, q); if (d < dm) { dm = d; mate = q; } }
    else { marcarEn(x, 9 + 24, A, q, V[3]); if (M.R.come[q.esp][A.esp] > 0) marcarEn(x, 9 + 16, A, q, V[2]); } });
  if (M.gigante) marcarEn(x, 9 + 32, A, M.gigante, V[4]);
  A.mate = mate; const n = N_ENT;
  x[n] = Math.min(1, A.lleva); x[n + 1] = dCasa < 6 ? 1 : 0; { const [dx, dz] = dif(A, K), a = ang(Math.atan2(dx, dz) - A.rumbo); x[n + 2] = Math.sin(a); x[n + 3] = Math.cos(a); } x[n + 4] = K.comida;
  if (A.oye) for (let i = 0; i < 2; i++) { const o = A.oye[i]; if (o && o.t > 0) { const [dx, dz] = dif(A, o), f = o.t / 3; x[n + 5 + 2 * i] = f; x[n + 6 + 2 * i] = Math.sin(ang(Math.atan2(dx, dz) - A.rumbo)) * f; } }
  x[n + 9] = mate ? mate.hambre : 0; x[n + 10] = A.meDieron; x[n + 11] = A.meAtaco;
  if (A.esp === 'arana') { let iz = 0, de = 0; for (const m of M.rastros) { if (m.K !== K) continue; const [dx, dz] = dif(A, m), d = Math.hypot(dx, dz); if (d > 15 || d < 0.5) continue; const a = ang(Math.atan2(dx, dz) - A.rumbo); if (Math.abs(a) > 1.6) continue; const f = (1 - d / 15) * Math.max(0, 1 - (M.t - m.t) / 300); if (a < 0) iz += f; else de += f; }
    x[n + 12] = Math.min(1, iz); x[n + 13] = Math.min(1, de);
    for (const q of M.atrapados) if (q.vivo && q.atrapado > 0 && q.telaDe === K && dist(A, q) < 40) { x[n + 14] = 1; marcarEn(x, 9, A, q, 40); } }
  return x;
}
function vivirGente(M, A, dt) {
  const E = M.R.esp[A.esp], C = M.R.come[A.esp], F = A.F, K = A.K, P = PUEDE[A.esp];
  if ((A.tDec -= dt) <= 0) { A.tDec = 0.5; A.o = A.red.paso(sentirGente(M, A)); }
  const rf = reflejo(M, A); let o = rf || A.o; A.caza = !!(rf && rf.caza); if (A.atrapado > 0) { A.atrapado -= dt; o = {giro: 0, vel: 0, accion: 0}; }
  let a = o.accion; if (!P[a] || (a === 1 && A.cansancio < 0.25)) a = 0; A.accion = a;
  A.rumbo += o.giro * F.giro * dt; A.v += (o.vel * E.v - A.v) * Math.min(1, dt * 3); if (a === 1) A.v *= Math.exp(-dt * 6); if (A.atrapado > 0) A.v = 0;
  if (A.tEmb > 0) A.tEmb -= dt; if (A.tSusto > 0) A.tSusto -= dt; if (A.tHace > 0) A.tHace -= dt;
  A.meDieron = Math.max(0, A.meDieron - dt / 20); A.meAtaco = Math.max(0, A.meAtaco - dt / 30); if (A.oye) for (const q of A.oye) if (q) q.t -= dt;
  let gesto = null;
  if (a === ACC.atacar && A.tEmb <= 0) golpe(M, A, E, F);
  else if ((a === ACC.senalA || a === ACC.senalB) && A.tHace <= 0) { A.tHace = 2; const i = a === ACC.senalA ? 0 : 1; gesto = i ? 'senalB' : 'senalA'; hizo(M, A, i ? 'señal B' : 'señal A');   // LAS SEÑALES: la oyen los de su especie a 60 m. Lo que quieran decir no esta escrito
    genteCerca(M, A.x, A.z, 60, q => { if (q !== A && q.esp === A.esp && dist(q, A) < 60) (q.oye || (q.oye = [null, null]))[i] = {x: A.x, z: A.z, t: 3}; }); }
  else if (a === ACC.dar && A.tHace <= 0 && A.mate && A.mate.vivo && dist(A, A.mate) < 2.5) { const q = A.mate; A.tHace = 3;   // DAR: de lo que lleva; o, si no lleva nada, de lo que tiene comido, al que tiene mas hambre que el
    if (A.lleva > 0.01) { const k = Math.min(A.lleva, 0.2); A.lleva -= k; q.hambre = Math.max(0, q.hambre - k * C.carne); q.meDieron = 1; gesto = 'da'; hizo(M, A, 'dio comida'); }
    else if (A.hambre < q.hambre - 0.1) { A.hambre = Math.min(1, A.hambre + 0.12); q.hambre = Math.max(0, q.hambre - 0.12); q.meDieron = 1; gesto = 'da'; hizo(M, A, 'dio comida'); } }
  else if (a === ACC.agarrar && A.tHace <= 0 && A.lleva < 0.6) { A.tHace = 1;   // AGARRAR lo que hay aca: carne (tambien de una despensa, la suya o la ajena) o pasto
    const c = M.cuerpos.find(q => q.carne > 0.02 && dist(q, A) < 2.5);
    if (c) { const k = Math.min(c.carne, 0.3); c.carne -= k; A.lleva += k; gesto = 'agarra'; hizo(M, A, c.K && c.K !== K ? 'robo de la despensa de otra tribu' : c.K ? 'saco de su despensa' : 'agarro carne'); }
    else if (C.pasto > 0 && C.carne > 0) { let mata = null; matasCerca(M, A.x, A.z, 4, p => { if (!mata && comible(M, p) > 0.1 && dist(A, p) < p.R) mata = p; }); if (mata) { const k = Math.min(comible(M, mata), 0.3); mata.comida -= k; A.lleva += k * C.pasto / C.carne; gesto = 'agarra'; hizo(M, A, 'agarro pasto'); } } }
  else if (a === ACC.soltar && A.tHace <= 0 && A.lleva > 0.01) { A.tHace = 1; gesto = 'suelta';   // SOLTAR: en casa va a la despensa; en cualquier otro lado queda tirado
    if (dist(A, K) < 6) { K.pila.carne = K.pila.carne + A.lleva; hizo(M, A, 'guardo en la despensa'); } else { M.cuerpos.push({x: A.x, z: A.z, carne: A.lleva}); hizo(M, A, 'solto comida'); } A.lleva = 0; }
  else if (a === ACC.tejer && A.tHace <= 0) { A.tHace = 20; A.hambre = Math.min(1, A.hambre + 0.04); gesto = 'teje'; hizo(M, A, 'tejio');   // TEJER: una tela aca. Al que la pisa (que no sea araña) lo deja quieto 4 s
    M.telas.push({x: A.x, z: A.z, K, t: M.t}); let mias = 0; for (const t of M.telas) if (t.K === K) mias++; if (mias > 14) M.telas.splice(M.telas.findIndex(t => t.K === K), 1); }
  else if (a === ACC.rastro && A.tHace <= 0) { A.tHace = 4; gesto = 'rastro'; hizo(M, A, 'dejo rastro'); M.rastros.push({x: A.x, z: A.z, K, t: M.t}); if (M.rastros.length > 600) M.rastros.shift(); }   // RASTRO: una marca en el suelo; dura 5 minutos
  mover(A, dt);
  const ritmo = A.v < 0.6 ? 1 : 0.3; A.edad += dt;
  A.hambre = Math.min(1, A.hambre + dt / E.tHambre); A.sed = Math.min(1, A.sed + dt / E.tSed); A.cansancio = Math.min(1, Math.max(0, A.cansancio + dt * (0.0006 + 0.005 * (A.v / E.v) ** 2)));
  let come = A.hambre > 0.05 && comer(M, A, C, dt, ritmo);
  if (!come && A.lleva > 0 && A.hambre > 0.5) { const k = Math.min(A.lleva, dt * 0.02); A.lleva -= k; A.hambre = Math.max(0, A.hambre - k * C.carne); come = true; }   // (con hambre, come de lo que lleva)
  let toma = false; if (A.sed > 0.03 && (dist(A, K) < 3.5 || enAgua(M, A))) { A.sed = Math.max(0, A.sed - dt * 0.08 * ritmo); toma = true; }
  if (gesto) { A.gesto = gesto; A.tGesto = 1.5; } else if (A.tGesto > 0) A.tGesto -= dt;
  A.que = A.atrapado > 0 ? 'atrapado' : A.tSusto > 0 ? 'huye' : A.tGesto > 0 ? A.gesto : A.tEmb > 1 ? 'muerde' : A.caza ? 'caza' : rf ? 'encara' : come && A.v < 0.6 ? 'come' : toma && A.v < 0.6 ? 'toma' : a === 1 && A.v < 0.4 ? 'echado' : A.lleva > 0.05 ? 'lleva' : A.v > 0.7 * E.v ? 'corre' : 'anda';
  if (!cuerpo(M, A, E, dt, a)) return;
  // IMITAR (el Steve): cada tanto mira a los suyos que tiene cerca; si a alguno le va mejor que a el (mas comido, tomado y
  // sano), le copia un poco de la red (1 de cada 20 pesos). Cuanto imita cada uno es SUYO y se hereda: puede irse a cero.
  if (A.esp === 'steve' && (A.tImita -= dt) <= 0) { A.tImita = 60; if (R() < A.imita) { const bien = q => q.salud - q.hambre - q.sed; let mejor = null, bm = bien(A) + 0.25; for (const q of K.miembros) if (q.vivo && q !== A && dist(q, A) < 20 && bien(q) > bm) { bm = bien(q); mejor = q; }
      if (mejor) { for (let i = 0; i < A.w.length; i++) if (R() < 0.05) A.w[i] = mejor.w[i]; hizo(M, A, 'imito a uno de los suyos'); } } }
  // LA CRIA: como los animales, pero de DOS: la red del hijo mezcla la suya con la de otro adulto sano de su tribu que tenga cerca
  if (A.edad > 600 && A.hambre < 0.4 && A.sed < 0.5 && A.salud > 0.8) { A.cria += dt / E.gesta;
    if (A.cria >= 1) { A.cria = 0; A.hambre = Math.min(1, A.hambre + 0.3); A.hijos++; const cand = K.miembros.filter(q => q.vivo && q !== A && q.edad > 600 && q.salud > 0.6 && dist(q, A) < 40), b = cand.length ? cand[Math.floor(R() * cand.length)] : null;
      nuevaGente(M, K, {x: A.x + (R() - 0.5) * 3, z: A.z + (R() - 0.5) * 3, w: cruzar(A.w, b && b.w), gen: Math.max(A.gen, b ? b.gen : 0) + 1, edad: 0, hambre: 0.45, sed: 0.4, imita: Math.max(0, Math.min(1, (A.imita + (b ? b.imita : A.imita)) / 2 + gauss() * 0.05)), padres: [A.id, b ? b.id : 0]});
      M.cuenta.nacen[A.esp] = (M.cuenta.nacen[A.esp] || 0) + 1; } }
}

// UN PASO del mundo entero. (El juego lo parte: pasoBase una vez y despues pasoTribu de a pocas tribus por cuadro, para no dar tirones)
export function paso(M, dt) { pasoBase(M, dt); for (const K of M.tribus) pasoTribu(M, K, dt); }
export function pasoTribu(M, K, dt) { if (K.enJuego) return; const l = K.miembros; for (let i = 0, n = l.length; i < n; i++) if (l[i].vivo) vivirGente(M, l[i], dt); }
export function pasoBase(M, dt) {
  M.t += dt; const F = M.R.flora;
  if ((M.tFlora = (M.tFlora || 0) + dt) >= 1) { const e = {aguaDe: (x, z) => aguaDe(M, x, z), lluvia: (M.t % 3600) < 600 ? F.lluvia : 1, agua: F.agua, ritmo: F.ritmo, hijo: genHijo, nace: m => { m.x = envolver(m.x); m.z = envolver(m.z); }};
    for (const l of M.celdas.values()) M.cuenta.nacenMatas += flora.pasoCelda(l, M.tFlora, e).nacen; M.tFlora = 0; }
  M.steves.length = 0; M.porEsp.steve.length = 0; M.porEsp.arana.length = 0; for (const K of M.tribus) for (const s of K.miembros) if (s.vivo) { M.steves.push(s); M.porEsp[K.esp].push(s); }
  armarRejilla(M);
  const G = M.gigante; if (G && !G.ajeno) { if ((G.tGiro -= dt) <= 0) { G.tGiro = 150 + R() * 150; G.rumbo += (R() - 0.5) * 1.5; } mover(G, dt);   /* (ajeno: al gigante lo mueve otro -el juego-; aca solo se lo ve) */
    if ((G.tPaso -= dt) <= 0) { G.tPaso = 1.3; G.lado = -G.lado; const pie = {x: G.x + Math.cos(G.rumbo) * 6 * G.lado, z: G.z - Math.sin(G.rumbo) * 6 * G.lado};
      for (const k of ANIMALES) for (const c of M.pob[k]) if (c.vivo && dist(c, pie) < 3) morir(M, c, 'pisada'); for (const s of M.steves) if (dist(s, pie) < 3) morir(M, s, 'pisada'); } }
  // LAS TELAS: al que la pisa (animal o Steve; las arañas no) lo deja quieto 4 s, y la tela se gasta. Duran 15 minutos
  M.atrapados = M.atrapados || [];
  if (M.telas.length) { for (let i = M.telas.length - 1; i >= 0; i--) { const t = M.telas[i]; if (M.t - t.t > 900) { M.telas.splice(i, 1); continue; } let cayo = null;
      for (const k of ANIMALES) { for (const q of M.pob[k]) if (q.vivo && !(q.atrapado > 0) && dist(q, t) < 2) { cayo = q; break; } if (cayo) break; }
      if (!cayo) genteCerca(M, t.x, t.z, 2, q => { if (!cayo && q.esp === 'steve' && q.vivo && !(q.atrapado > 0) && dist(q, t) < 2) cayo = q; });
      if (cayo) { cayo.atrapado = 4; cayo.telaDe = t.K; M.atrapados.push(cayo); M.telas.splice(i, 1); M.cuenta.hizo['arana: una tela atrapo algo'] = (M.cuenta.hizo['arana: una tela atrapo algo'] || 0) + 1; } }
    M.atrapados = M.atrapados.filter(q => q.vivo && q.atrapado > 0); }
  for (const l of M.celdas.values()) for (const p of l) { p.bocasAnt = p.bocas || 0; p.bocas = 0; }
  for (const k of ANIMALES) { const l = M.pob[k]; for (let i = 0, n = l.length; i < n; i++) if (l[i].vivo) vivir(M, l[i], dt); }
  for (const c of M.cuerpos) c.carne = Math.max(0, c.carne - dt / (c.fija ? 6 * M.R.pudre : M.R.pudre));   // (se pudre; lo guardado en una despensa, mucho mas despacio)
  // limpiar los muertos, y LO UNICO que no sale solo: si una especie (o una tribu) se extingue, a los 10 (20) minutos LLEGAN
  // de afuera unos pocos, con las redes de los ultimos que tuvieron cria (o la semilla). Se cuenta, para no esconderlo
  if ((M.tLimpia = (M.tLimpia || 0) + dt) >= 5) { M.tLimpia = 0; M.cuerpos = M.cuerpos.filter(c => c.fija || c.carne > 0); M.tSin = M.tSin || {};
    while (M.rastros.length && M.t - M.rastros[0].t > 300) M.rastros.shift();
    for (const k of ANIMALES) { M.pob[k] = M.pob[k].filter(c => c.vivo); if (M.pob[k].length || !M.semillas?.[k] || !M.quiere[k]) { M.tSin[k] = 0; continue; }
      if ((M.tSin[k] = (M.tSin[k] || 0) + 5) >= 600) { M.tSin[k] = 0; M.cuenta.llegadas[k] = (M.cuenta.llegadas[k] || 0) + 1; const oa = M.oasis[Math.floor(R() * M.oasis.length)], b = M.banco[k];
        for (let i = 0; i < 4 && M.oasis.length; i++) { const q = b.length ? b[Math.floor(R() * b.length)] : {w: M.semillas[k], tam: 1}; nacer(M, k, oa.x + (R() - 0.5) * 60, oa.z + (R() - 0.5) * 60, pesosHijos(q.w), q.tam, null); } } }
    for (const K of M.tribus) { K.miembros = K.miembros.filter(s => s.vivo); if (K.miembros.length || K.enJuego) { K.tVacia = 0; continue; }   /* (enJuego: su gente esta en el 3D; aca no se toca) */
      if (M.semillaG && (K.tVacia = (K.tVacia || 0) + 5) >= 1200) { K.tVacia = 0; poblarTribu(M, K, K.esp); M.cuenta.llegadas[K.esp] = (M.cuenta.llegadas[K.esp] || 0) + 1; } } }
}

// ---------- MIRAR ----------
export function censo(M) {
  const med = (l, f) => l.length ? +(l.reduce((a, e) => a + f(e), 0) / l.length).toFixed(2) : 0, c = {minuto: Math.round(M.t / 60), matas: flora.resumen(M.celdas.values()), esp: {}, ...M.cuenta};
  for (const k of ANIMALES) { const l = M.pob[k].filter(a => a.vivo); c.esp[k] = {n: l.length, tam: med(l, a => a.tam), gen: l.reduce((a, e) => Math.max(a, e.gen), 0), genMedia: med(l, a => a.gen), hambre: med(l, a => a.hambre), llegadas: M.cuenta.llegadas[k] || 0}; }
  for (const k of TRIBALES) { const l = []; for (const K of M.tribus) if (K.esp === k) for (const s of K.miembros) if (s.vivo) l.push(s); c.esp[k] = {n: l.length, tam: 1, gen: l.reduce((a, e) => Math.max(a, e.gen), 0), genMedia: med(l, a => a.gen), hambre: med(l, a => a.hambre), imita: med(l, a => a.imita), llegadas: M.cuenta.llegadas[k] || 0}; }
  c.tribus = M.tribus.map(K => ({esp: K.esp, n: K.miembros.filter(q => q.vivo).length, comida: +K.comida.toFixed(2), gen: K.gen}));
  return c;
}
// LA FOTO: todo lo que hace falta para seguir desde aca (desdeFoto), o para arrancar el juego desde este momento
export function foto(M) {
  const r4 = w => Array.from(w, v => Math.round(v * 1e4) / 1e4), n3 = v => Math.round(v * 1e3) / 1e3, cuerpoDe = c => ({hambre: n3(c.hambre), sed: n3(c.sed), cansancio: n3(c.cansancio), salud: n3(c.salud)});
  const f = {version: 4, t: M.t, L, receta: diferencia(M.R), censo: censo(M), oasis: M.oasis, gigante: M.gigante, cuenta: M.cuenta, quiere: M.quiere, animales: {},
    matas: [...M.celdas.values()].flat().map(p => ({x: n3(p.x), z: n3(p.z), comida: n3(p.comida), tam: n3(p.tam ?? 1), res: n3(p.res || 0), semE: n3(p.semE || 0), gen: p.gen || 0, hija: !!p.hija, g: {...p.g, w: r4(p.g.w || [])}}))};
  for (const k of ANIMALES) f.animales[k] = M.pob[k].filter(c => c.vivo).map(c => ({x: n3(c.x), z: n3(c.z), rumbo: n3(c.rumbo), tam: n3(c.tam), edad: Math.round(c.edad), gen: c.gen, cria: n3(c.cria), hijos: c.hijos, presas: c.presas, ...cuerpoDe(c), w: r4(c.w)}));
  f.tribus = M.tribus.map(K => ({esp: K.esp, x: n3(K.x), z: n3(K.z), comida: n3(K.comida), estetica: K.estetica, agresiva: K.agresiva, gen: K.gen, pisadas: K.pisadas, rencorGig: K.rencorGig, plId: K.plId, cultura: K.cultura || null,
    miembros: K.miembros.filter(q => q.vivo).map(q => ({x: n3(q.x), z: n3(q.z), gen: q.gen, edad: Math.round(q.edad), hijoDeDos: !!q.padres, ...cuerpoDe(q), lleva: n3(q.lleva), imita: n3(q.imita), w: r4(q.w), cerebro: q.cerebro ? Array.from(q.cerebro, n3) : undefined, ficha: q.ficha || undefined}))}));
  return f;
}
// volver a armar un mundo desde una foto. o: {semillas, semillaTribu} (para los que lleguen de afuera); o.receta: lo que se quiera cambiar encima
export function desdeFoto(f, o = {}) {
  const M = mundoVacio({...o, receta: mezclar(mezclar(recetaBase(), f.receta), o.receta)}); M.t = f.t || 0; M.oasis = f.oasis.map(q => ({...q})); M.gigante = f.gigante ? {...f.gigante} : null;
  M.quiere = f.quiere ? {...f.quiere} : {cerdo: true, coyote: true};
  if (f.cuenta) M.cuenta = {nacen: {...f.cuenta.nacen}, nacenMatas: f.cuenta.nacenMatas || 0, muertes: {...f.cuenta.muertes}, llegadas: {...f.cuenta.llegadas}, hizo: {...f.cuenta.hizo}};
  for (const p of f.matas) celdaDe(M, p.x, p.z).push({x: envolver(p.x), z: envolver(p.z), comida: p.comida, tam: p.tam, res: p.res, semE: p.semE || 0, gen: p.gen, hija: p.hija, R: 3, sem: R() * 100, g: {...p.g, w: Float32Array.from(p.g.w)}});
  for (const k of ANIMALES) for (const c of f.animales?.[k] || []) nacer(M, k, c.x, c.z, Float32Array.from(c.w), c.tam, null, {rumbo: c.rumbo, edad: c.edad, gen: c.gen, cria: c.cria || 0, hijos: c.hijos || 0, presas: c.presas || 0, hambre: c.hambre, sed: c.sed, cansancio: c.cansancio, salud: c.salud});
  if (M.semillaG) for (const t of f.tribus || []) { const K = campo(M, t);
    for (const q of t.miembros) { const s = nuevaGente(M, K, {...q, w: q.w || q.ficha?.wF, padres: null}); if (q.hijoDeDos) s.padres = [0, 0]; } }
  return M;
}
