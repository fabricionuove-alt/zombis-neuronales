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
//    Los dos pueden ATACAR lo que tienen enfrente: su presa, o a cualquier otro, se le parezca o no.
//    (09-10) NO HAY CAMPAMENTOS PUESTOS NI CRIA AUTOMATICA: ver «LOS LUGARES», «LA REMERA» y «APAREARSE» mas abajo. Lo que sigue (08-10) vale con
//    eso encima: lo que se ve de lejos es la remera (se contagia); la marca heredada son los genes, y se nota solo de cerca.
//    LA TRIBU NO ES UNA ETIQUETA (08-10): cada uno lleva una MARCA visible (un color) que hereda de sus padres con mutacion. Lo que
//    siente de los demas no es "mio / ajeno" sino CUANTO SE LE PARECE cada uno (Riolo, Cohen y Axelrod 2001; Hammond y Axelrod 2006;
//    el gen de color de Polyworld). A quien trata como propio -a quien le da, a quien ataca- lo decide su red. El campamento es
//    solo el lugar donde nacio: ahi esta la despensa y el ALJIBE, que junta agua cuando llueve y se gasta al tomar.
// LO QUE SIGUE SIENDO REGLA, declarado: los reflejos a pocos metros (el que es presa encara; el que caza ANIMALES, con hambre
// y la presa a 12 m, se le tira encima: entre gente no hay reflejo, atacar es cosa de la red), comer y tomar cuando esta encima
// de la comida o el agua, que en una mata grande la presa quieta no se ve de lejos, y el gigante (camina y pisa).
import {crearRed, nPesos, OCULTAS} from './red2.js';
import * as flora from './floraViva.js';

const amb = (k, d) => +((globalThis.__vivoCfg?.[k] ?? (typeof process !== 'undefined' && process.env[k])) || d);   // (del entorno en Node, de globalThis.__vivoCfg en el navegador)
// (el lado del mundo, en metros -se cierra sobre si mismo-; multiplo de 150)
// X0: donde empieza el mundo en x y en z (el juego lo pone en -L/2: asi el mundo queda centrado en su origen y los dos usan las mismas coordenadas)
export const L = amb('L', 600), X0 = amb('X0', 0), CELDA = 150, DIA = 1200, SECT = 8, N_ENT = 9 + SECT * 6, N_ACC = 4;
export const N_ENT_G = N_ENT + 21, N_ACC_G = 11, N_PESOS_G = nPesos(N_ENT_G, N_ACC_G);   // la gente: 21 sentidos y 7 acciones mas
export const ANIMALES = ['cerdo', 'coyote'], TRIBALES = ['steve', 'arana'], ESPECIES = [...ANIMALES, ...TRIBALES], COMIDAS = ['pasto', 'carne', ...ESPECIES];
// las acciones de la gente (el numero es la salida de la red)
export const ACC = {nada: 0, echarse: 1, senalA: 2, atacar: 3, senalB: 4, dar: 5, agarrar: 6, soltar: 7, tejer: 8, rastro: 9, aparear: 10};
const PUEDE = {steve: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1], arana: [1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1]};   // (el Steve tiene manos; la araña, tela y rastro)
// lo que NO es de la receta (la forma del cuerpo): giro en rad/s, hasta donde ve cada canal [comida, agua, peligro, gente, gigante, los suyos], el arranque de la embestida
const FIJO = {cerdo: {giro: 2.6, vista: [40, 350, 60, 60, 200, 50], embiste: 5.5}, coyote: {giro: 3.2, vista: [80, 350, 60, 60, 200, 60], embiste: 8},
  steve: {giro: 3.0, vista: [60, 350, 60, 80, 200, 60], embiste: 6.5}, arana: {giro: 3.4, vista: [60, 350, 60, 80, 200, 60], embiste: 7.5}};

// ---------- LA RECETA ----------
// come[quien][que]: para 'pasto' y 'carne', cuanto le baja el hambre cada unidad que come (0 = no lo come). Para una
//   especie, mas de 0 = LA CAZA (la mata para comer); lo que llena es la carne que deja.
// esp[...]: v = velocidad maxima (m/s); tHambre / tSed = segundos de 0 a 1; gesta = segundos de buena vida para una cria;
//   tam = el tamaño de cuerpo con el que arrancan los que llegan (despues, cada uno hereda el suyo); vida = segundos hasta la vejez; mordida = salud que saca un golpe; carne = cuanta carne tiene un cuerpo adulto de tamaño 1 (ver LA ENERGIA);
//   hambreCaza = con cuanta hambre sale a cazar (0.25 = casi siempre; 0.6 = solo con hambre de verdad).
// flora: energia = la energia TOTAL del mundo, por celda de 150 m (ver EL CIRCUITO CERRADO); matas = cuantas matas por celda al arrancar
//   (en lo mas humedo; en lo seco, menos): la comida tiene que estar POR TODOS LADOS -como los pellets de los Bibites o el pasto de
//   lobos-ovejas-pasto-, no una mata cada cien metros que nadie encuentra;  agua = la que hay por celda de 150 m; ritmo = que tan rapido crece todo; lluvia = cuanto mas rinde lloviendo;
//   resto = la parte de la mata que no se alcanza a comer; bocas = cuantos comen a la vez de una mata comun.
// costoTam: cuanto mas gasta el grande (exponente del metabolismo; 0.75 = Kleiber). pudre: segundos que dura la carne tirada.
// olfatoAgua: desde cuantos metros saben donde hay agua.
// (12-10) se saco lo de «el que vive de carne aguanta mas sin comer» (lo habia puesto yo el 11-10): un cazador que no se muere cuando
//   falta la presa la persigue hasta la ultima. En lobos-ovejas-pasto el lobo vive 20 pasos por oveja: sin presa, cae rapido, y la presa se recupera.
// EL CIRCUITO CERRADO (12-10; copiado de The Bibites, que funciona: «Since Energy in The Bibites simulation is a Closed System, most
//   energy wastes are recycled and returned as new biomass»): el mundo tiene una cantidad FIJA de energia (flora.energia por celda de
//   150 m; 0 = la que tenga al arrancar, mas un cuarto). Esta repartida entre las matas, los cuerpos y las reservas de los bichos,
//   lo que llevan, la carne tirada... y la ENERGIA LIBRE, que es lo que sobra. Todo lo que se gasta (vivir, correr, lo que no se
//   aprovecha de una comida, la carne que se pudre) vuelve a ser energia libre, y las matas SOLO crecen sacando de ahi. Con muchos
//   bichos queda poca libre y el pasto frena solo; cuando mueren, vuelve y rebrota. Nadie fija cuantos animales entran: lo fija el total.
//   energia(M) da la cuenta; el total tiene que dar igual hora tras hora (tools/vivo/energia.mjs lo comprueba).
// LA ENERGIA SE CONSERVA (11-10): la carne de un cuerpo no sale de la nada. Cada uno se hace el cuerpo con una parte de lo que come
//   (eficiencia: 0.1 = la regla del 10 % de Lindeman 1942), hasta el cuerpo de un adulto; al morir deja ESA carne, la que llego a
//   hacerse. Antes un cerdo dejaba 1 de carne habiendo comido ~3 de pasto, y esa carne llenaba mas que el pasto: pasar por el cerdo
//   duplicaba la energia. Ahora deja como mucho 0.2: comer cerdo rinde ~un quinto de lo que rendiria comerse su pasto.
export function recetaBase() {
  return {
    come: {
      cerdo:  {pasto: 1.6, carne: 0,   cerdo: 0, coyote: 0, steve: 0, arana: 0},
      coyote: {pasto: 0,   carne: 2.5, cerdo: 1, coyote: 0, steve: 0, arana: 0},
      steve:  {pasto: 0.8, carne: 2.5, cerdo: 1, coyote: 0, steve: 0, arana: 0},   // (los Steves tambien comen pasto)
      arana:  {pasto: 0,   carne: 2.5, cerdo: 1, coyote: 0, steve: 1, arana: 0},   // (las arañas cazan Steves)
    },
    esp: {
      cerdo:  {v: 4.6, tam: 1,    tHambre: 600,  tSed: 400,  gesta: 900,  vida: 4 * 3600, mordida: 0.35, carne: 0.2,   hambreCaza: 0.25},   // (09-10: el cerdo tambien lastima cuando embiste)
      coyote: {v: 9.5, tam: 0.55, tHambre: 900,  tSed: 500,  gesta: 2400, vida: 5 * 3600, mordida: 0.5,  carne: 0.2, hambreCaza: 0.25},   // (09-10: el doble de rapido que un cerdo, y la mitad de cuerpo)
      steve:  {v: 5.6, tam: 1,    tHambre: 1500, tSed: 1200, gesta: 1500, vida: 6 * 3600, mordida: 0.4,  carne: 0.2, hambreCaza: 0.25},
      arana:  {v: 6.5, tam: 1,    tHambre: 1200, tSed: 1000, gesta: 500,  vida: 3 * 3600, mordida: 0.5,  carne: 0.2, hambreCaza: 0.25},
    },
    flora: {agua: 150, ritmo: 1, lluvia: 1.4, resto: 0.15, bocas: 3, energia: 160, matas: 40},   // (13-10: agua 30 -> 150, energia 40 -> 160 y 40 matas por celda al arrancar: con el suelo de antes no entraban mas de 20 o 30 Steves por mundo, y sin gente no hay cultura -Henrich 2004-. Las matas siguen naciendo y muriendo solas: esto es cuanta agua y cuanta energia hay, no cuantas matas)
    costoTam: 0.75, pudre: 900, olfatoAgua: 350, eficiencia: 0.1,
    cultura: {contagio: 20, deriva: 0.01, aprende: 120, inventa: 0.006, error: 1, suerte: 0.04},   // (ver LA CULTURA: cada cuantos segundos se cruza con otro; cada cuanto mira al mejor; que tan seguido inventa; cuanto pierde al copiar; cuanta suerte)
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

const R = flora.azar, TAU = 6.2832;   // (el azar, con semilla: ver sembrar en floraViva.js)
export const sembrar = flora.sembrar;
const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
const env = d => d - L * Math.round(d / L), dif = (a, b) => [env(b.x - a.x), env(b.z - a.z)], dist = (a, b) => Math.hypot(env(b.x - a.x), env(b.z - a.z));
const ang = a => Math.atan2(Math.sin(a), Math.cos(a)), envolver = v => (((v - X0) % L) + L) % L + X0, lim = v => Math.max(-1, Math.min(1, v));
const mover = (e, dt) => { e.x = envolver(e.x + Math.sin(e.rumbo) * e.v * dt); e.z = envolver(e.z + Math.cos(e.rumbo) * e.v * dt); };
export const noche = M => 0.5 + 0.5 * Math.cos(((M.t % DIA) / DIA) * TAU);
const deFrente = (P, Q) => { const [dx, dz] = dif(P, Q), d = Math.hypot(dx, dz) || 1; return (dx * Math.sin(P.rumbo) + dz * Math.cos(P.rumbo)) / d > 0.5 && P.v < 2; };
export const comible = (M, p) => p.comida - M.R.flora.resto * (p.tam || 1);   // lo que se le puede sacar a una mata (el resto no se alcanza: Noy-Meir 1975)

// ---------- LA HERENCIA ----------
export const MUT = {prob: 0.1, sigma: 0.08};
export function pesosHijos(w) { const h = Float32Array.from(w); for (let i = 0; i < h.length; i++) if (R() < MUT.prob) h[i] += gauss() * MUT.sigma; return h; }
// el hijo de DOS (la gente): cada peso, de uno de los dos; uno de cada diez, corrido un poco
export function cruzar(a, b) { const h = new Float32Array(a.length); for (let i = 0; i < h.length; i++) { h[i] = b && R() < 0.5 ? b[i] : a[i]; if (R() < MUT.prob) h[i] += gauss() * MUT.sigma; } return h; }
const tamHijo = t => Math.max(0.3, Math.min(2.2, t + gauss() * 0.04));
// EL CUERPO QUE TIENE HOY: nace chico (0.4 de lo que va a ser) y termina de crecer a los 10 minutos
const talla = A => A.tam * (0.4 + 0.6 * Math.min(1, A.edad / 600));
const genNuevo = () => ({crece: 0.8 + R() * 0.4, sequia: R() * 0.3, fibra: R() * 0.3, espina: R() * 0.25, dispersa: 0.3 + R() * 0.4});
const genHijo = g => { const m = x => Math.min(1, Math.max(0, x + (R() - 0.5) * 0.1)); return {crece: Math.min(1.6, Math.max(0.5, g.crece + (R() - 0.5) * 0.1)), sequia: m(g.sequia), fibra: m(g.fibra), espina: m(g.espina), dispersa: m(g.dispersa)}; };
// una mata nueva: del pozo (si este mundo arranca desde otro), o al azar
const mataNueva = M => { const l = M.pozo?.mata; if (!l || !l.length) return genNuevo(); const p = l[Math.floor(R() * l.length)]; return {crece: p.crece, sequia: p.sequia, fibra: p.fibra, espina: p.espina, dispersa: p.dispersa, w: Float32Array.from(p.w)}; };
// LA SEMILLA DE LA GENTE: la red de un animal ya entrenado (la de Cresta salvaje: sabe ir a la comida y al agua, y echarse),
// agrandada: los sentidos nuevos arrancan sin peso, y las acciones nuevas, con pesos chicos al azar y pocas ganas (salen de vez
// en cuando: lo justo para que la seleccion tenga de donde agarrarse). Nada de eso esta entrenado. La unica que arranca
// ENCENDIDA es aparearse (ver instinto): sin eso se extinguen antes de aprenderla (le paso a Polyworld).
function agrandar(w0, n0, a0) {
  const w = new Float32Array(N_PESOS_G), O = OCULTAS, n1 = N_ENT_G, s0 = 2 + a0, s1 = 2 + N_ACC_G;
  const iWh0 = n0 * O, iB0 = iWh0 + O * O, iWo0 = iB0 + O, iBo0 = iWo0 + O * s0, iWh1 = n1 * O, iB1 = iWh1 + O * O, iWo1 = iB1 + O, iBo1 = iWo1 + O * s1;
  for (let j = 0; j < O; j++) for (let i = 0; i < n0; i++) w[j * n1 + i] = w0[j * n0 + i];
  for (let i = 0; i < O * O + O; i++) w[iWh1 + i] = w0[iWh0 + i];
  let piso = 1e9; for (let k = 2; k < s0; k++) piso = Math.min(piso, w0[iBo0 + k]);
  for (let k = 0; k < s1; k++) { if (k < s0) { for (let j = 0; j < O; j++) w[iWo1 + k * O + j] = w0[iWo0 + k * O + j]; w[iBo1 + k] = w0[iBo0 + k]; }
    else { for (let j = 0; j < O; j++) w[iWo1 + k * O + j] = gauss() * 0.15; w[iBo1 + k] = piso + 0.1 + gauss() * 0.3; } }
  return w;
}
// EL INSTINTO DE APAREARSE, puesto en la red (no es una regla aparte: son pesos, y la evolucion los puede cambiar o borrar): se
// toma la neurona de adentro que menos pesa en lo que la red hace, y se la conecta del sentido del CELO a la accion «aparearse».
// Con el celo lleno, la red elige aparearse; con el celo bajo, no.
export const INSTINTO = {entra: 4, base: -2.4, sale: 3.2, piso: 0.4};
function instinto(w) {
  const O = OCULTAS, n1 = N_ENT_G, s1 = 2 + N_ACC_G, iWh = n1 * O, iB = iWh + O * O, iWo = iB + O, iBo = iWo + O * s1, kA = 2 + ACC.aparear;
  let j = 0, mj = 1e9; for (let q = 0; q < O; q++) { let m = 0; for (let k = 0; k < s1; k++) if (k !== kA) m += Math.abs(w[iWo + k * O + q]); for (let i = 0; i < O; i++) m += Math.abs(w[iWh + i * O + q]) * 0.5; if (m < mj) { mj = m; j = q; } }
  for (let i = 0; i < n1; i++) w[j * n1 + i] = 0; w[j * n1 + N_ENT + 16] = INSTINTO.entra;
  for (let i = 0; i < O; i++) { w[iWh + j * O + i] = 0; w[iWh + i * O + j] = 0; } w[iB + j] = INSTINTO.base;
  let techo = -1e9; for (let k = 2; k < s1; k++) if (k !== kA) techo = Math.max(techo, w[iBo + k]);
  for (let k = 0; k < s1; k++) w[iWo + k * O + j] = 0; for (let q = 0; q < O; q++) w[iWo + kA * O + q] = 0; w[iWo + kA * O + j] = INSTINTO.sale; w[iBo + kA] = techo + INSTINTO.piso;
  return w;
}
export function semillaGente(w57) { return instinto(agrandar(w57, N_ENT, N_ACC)); }
// la red de uno de la gente, en la forma de ahora. Las de antes (15 o 16 sentidos de mas y 10 acciones) se AGRANDAN: lo nuevo arranca sin peso, y el instinto, puesto
const FORMAS_VIEJAS = [[N_ENT + 15, 10], [N_ENT + 16, 10]];
export function redGente(w) { if (!w) return null; if (w.length === N_PESOS_G) return w instanceof Float32Array ? w : Float32Array.from(w);
  for (const [n0, a0] of FORMAS_VIEJAS) if (w.length === nPesos(n0, a0)) return instinto(agrandar(w, n0, a0)); return null; }
// COLORES (la remera, los genes): una vuelta de 0 a 1. difC: que tan lejos estan dos (0 a 0.5); parecidoM: 1 = iguales, 0 = lo mas distinto;
// haciaC: de a hacia b, la parte k del camino (por el lado corto)
const vuelta = v => ((v % 1) + 1) % 1, difC = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 1 - d); }, parecidoM = (a, b) => 1 - 2 * difC(a, b);
const haciaC = (a, b, k) => { let d = b - a; d -= Math.round(d); return vuelta(a + d * k); };
// ---------- LA CULTURA (13-10, Fabri: "no me interesa que solo sobrevivan, quiero que armen cultura") ----------
// Lo que la gente (Steves y arañas) sabe y acostumbra NO viene de nacimiento ni esta en su red: lo lleva cada uno, lo toma de los
// demas, y puede perderse. Dos cosas, copiadas de los modelos que ya lo resolvieron:
//
// 1. LAS COSTUMBRES (A.cult: una tira de rasgos, cada uno con pocas variantes). Se contagian como en Axelrod 1997 («The
//    dissemination of culture», el modelo de los rasgos de Sugarscape con homofilia): cada tanto uno se cruza con otro de su especie
//    que tenga cerca; CUANTO MAS SE PARECEN sus costumbres, mas probable es que se traten; y si se tratan, toma de el una de las
//    costumbres en las que difieren. Resultado conocido: se igualan los vecinos y quedan culturas distintas entre regiones.
//    El hijo arranca con las de quien lo tuvo. Muy de vez en cuando alguien cambia una por su cuenta (deriva).
//    Una costumbre NO decide por la red: habilita, prohibe o le cambia el sentido a lo que el cuerpo puede hacer.
//      0 lo que no comen        nada / cerdo / carroña (lo que nadie cazo) / pasto (el Steve) o Steve (la araña)
//      1 con quien comparten    con todos / con los de su remera / con nadie            (a quien le pueden DAR)
//      2 guardar                comen donde encuentran / llevan y guardan               (si pueden AGARRAR y SOLTAR)
//      3 mudarse                se quedan / se van cuando falta                         (si con hambre olvidan su «casa»)
//      4 los muertos            los dejan / los entierran / se los comen                (que hacen con el cuerpo de uno de los suyos)
//      5 pareja                 con cualquiera / con los de su remera / con los de otra  (con quien pueden tener cria)
//      6 el extraño             lo evitan / lo toleran / lo atacan                      (el de su especie y otra remera: peligro, nada, o golpe)
//      7 que quiere decir el aviso   peligro / comida / reunion     (cuando avisan, y como lo oyen: sirve solo si el grupo coincide -McElreath et al. 2003-)
//      8 adorno                 liso / rayas / manchas / puntos    (NO hace nada: es la marca neutra, como el color de la flecha de Mesoudi; mide la moda)
//      9 lo propio              la araña: donde teje (donde sea / junto al agua / en su lugar) · el Steve: saludo (ninguno / mano / reverencia; neutro)
//
// 2. LAS TECNICAS (A.tec: cuanto sabe de cada una, de 0 a 1). Se INVENTAN (raro), se APRENDEN mirando al que le va mejor, y se
//    aprenden CON ERROR, como en Henrich 2004 («Demography and cultural evolution», el modelo de Tasmania): el que aprende queda
//    casi siempre un poco peor que su modelo y a veces mejor. Las complejas pierden mas en cada copia, asi que un grupo chico las
//    pierde primero (Derex et al. 2013). Y unas habilitan otras (Kolodny, Creanza y Feldman 2015).
//      punta     simple     golpea mas fuerte                         (la flecha de Mesoudi y O'Brien)
//      conserva  simple     lo que deja guardado se pudre mas despacio (Testart 1982: guardar ata al lugar)
//      agua      simple     lleva agua encima: puede alejarse del agua  (la esponja de hojas de los chimpances, Whiten et al. 1999)
//      trampa    compleja   el Steve puede poner trampas; la de la araña (su tela) retiene mas   (la red de pesca de Derex)
//      fuego     compleja   la carne le rinde mas; solo la inventa quien ya sabe punta y conserva
export const RASGOS = [
  {id: 'tabu', nombre: 'Lo que no comen', valores: ['nada', 'cerdo', 'carroña', 'pasto / Steve']},
  {id: 'reparto', nombre: 'Con quién comparten', valores: ['con todos', 'con los de su remera', 'con nadie']},
  {id: 'guardar', nombre: 'La comida', valores: ['comen donde encuentran', 'llevan y guardan']},
  {id: 'mudarse', nombre: 'Si falta comida', valores: ['se quedan', 'se van']},
  {id: 'muertos', nombre: 'Sus muertos', valores: ['los dejan', 'los entierran', 'se los comen']},
  {id: 'pareja', nombre: 'Pareja', valores: ['con cualquiera', 'con los de su remera', 'con los de otra remera']},
  {id: 'extrano', nombre: 'Al extraño', valores: ['lo evitan', 'lo toleran', 'lo atacan']},
  {id: 'senal', nombre: 'El aviso quiere decir', valores: ['peligro', 'comida', 'reunión']},
  {id: 'adorno', nombre: 'Adorno', valores: ['liso', 'rayas', 'manchas', 'puntos']},
  {id: 'propio', nombre: 'Tejen / saludan', valores: ['donde sea / ninguno', 'junto al agua / mano', 'en su lugar / reverencia']}];
export const TECNICAS = {punta: {nombre: 'Punta', error: 0.03}, conserva: {nombre: 'Conservar comida', error: 0.03}, agua: {nombre: 'Llevar agua', error: 0.03},
  trampa: {nombre: 'Trampa', error: 0.08, compleja: true}, fuego: {nombre: 'Fuego', error: 0.08, compleja: true, pide: ['punta', 'conserva']}};
const NRAS = RASGOS.length, CLAVES_TEC = Object.keys(TECNICAS);
const cultAzar = () => Uint8Array.from(RASGOS, r => Math.floor(R() * r.valores.length));
// las costumbres de uno nuevo: las que le pasan (su madre, su foto), o las de su grupo con alguna cambiada
const cultDe = base => { const c = base ? Uint8Array.from(base) : cultAzar(); if (base) for (let i = 0; i < NRAS; i++) if (R() < 0.12) c[i] = Math.floor(R() * RASGOS[i].valores.length); return c; };
const tecDe = (esp, t) => { const o = {}; for (const k of CLAVES_TEC) o[k] = t?.[k] ?? (k === 'trampa' && esp === 'arana' ? 0.3 : 0); return o; };   // (la araña nace sabiendo tejer algo: su tela)
const gumbel = b => -b * Math.log(-Math.log(Math.max(1e-9, Math.min(1 - 1e-9, R()))));
// APRENDER una tecnica de otro, con error (Henrich 2004): lo que le queda = lo del modelo - el error de esa tecnica + suerte
const copiaTec = (M, z, k) => Math.max(0, Math.min(1, z - TECNICAS[k].error * M.R.cultura.error + gumbel(M.R.cultura.suerte)));
// lo que el hijo trae de quien lo tuvo: sus costumbres, y sus tecnicas aprendidas con el mismo error
const tecHijo = (M, A) => { const o = {}; for (const k of CLAVES_TEC) o[k] = A.tec[k] > 0.05 ? Math.min(A.tec[k], copiaTec(M, A.tec[k], k)) : 0; if (A.esp === 'arana') o.trampa = Math.max(o.trampa, 0.2); return o; };
// lo que su costumbre le prohibe comer (c: un cuerpo o una pila de comida)
const vedada = (A, c) => { const t = A.cult[0]; return (t === 1 && c.esp === 'cerdo') || (t === 2 && c.esp && !c.caza) || (t === 3 && A.esp === 'arana' && c.esp === 'steve') || (c.esp === A.esp && A.cult[4] !== 2); };
const presaVedada = (A, k) => (A.cult[0] === 1 && k === 'cerdo') || (A.cult[0] === 3 && A.esp === 'arana' && k === 'steve');
const parejaVale = (A, q) => { const c = A.cult[5]; if (!c) return true; const igual = parecidoM(A.remera, q.remera) > 0.75; return c === 1 ? igual : !igual; };
// UN RATO DE VIDA CULTURAL de uno: cada tanto se cruza con otro y toma una costumbre; cada tanto mira al que le va mejor y aprende una tecnica; rara vez inventa
function cultura(M, A, dt) { const P = M.R.cultura;
  if ((A.tCult -= dt) <= 0) { A.tCult = P.contagio * (0.5 + R()); const cerca = []; genteCerca(M, A.x, A.z, 12, q => { if (q.vivo && q !== A && q.esp === A.esp && dist(A, q) < 12) cerca.push(q); });
    if (cerca.length) { const q = cerca[Math.floor(R() * cerca.length)], dif = []; for (let i = 0; i < NRAS; i++) if (A.cult[i] !== q.cult[i]) dif.push(i);
      if (dif.length && R() < (NRAS - dif.length) / NRAS) { const i = dif[Math.floor(R() * dif.length)]; A.cult[i] = q.cult[i]; hizo(M, A, 'tomo de otro una costumbre: ' + RASGOS[i].id); } }
    if (R() < P.deriva) { const i = Math.floor(R() * NRAS); A.cult[i] = Math.floor(R() * RASGOS[i].valores.length); hizo(M, A, 'cambio una costumbre por su cuenta'); } }
  if ((A.tTec -= dt) <= 0) { A.tTec = P.aprende * (0.5 + R());
    if (A.edad > 600 && R() < P.inventa) { const ks = CLAVES_TEC.filter(k => !TECNICAS[k].pide || TECNICAS[k].pide.every(p => A.tec[p] >= 0.3)), k = ks[Math.floor(R() * ks.length)], antes = A.tec[k];
      A.tec[k] = Math.min(1, antes + 0.05 + R() * 0.1); hizo(M, A, (antes < 0.05 ? 'invento: ' : 'mejoro por su cuenta: ') + k); }
    const bien = q => q.salud - q.hambre - q.sed; let mejor = null, bm = bien(A) + 0.1; genteCerca(M, A.x, A.z, 20, q => { if (q.vivo && q !== A && q.esp === A.esp && dist(q, A) < 20 && bien(q) > bm) { bm = bien(q); mejor = q; } });
    if (mejor) { const ks = CLAVES_TEC.filter(k => mejor.tec[k] > A.tec[k] + 0.02); if (ks.length) { const k = ks[Math.floor(R() * ks.length)], z = copiaTec(M, mejor.tec[k], k); if (z > A.tec[k]) { A.tec[k] = z; hizo(M, A, 'aprendio de otro: ' + k); } else hizo(M, A, 'quiso aprender y no le salio: ' + k); } } }
}
// como esta la cultura de una especie: cuanto saben en promedio, cuantas maneras distintas de vivir hay, y la costumbre mas comun de cada rasgo
function culturaDeEspecie(l) { if (!l.length) return null; const tec = {}, mx = {}; for (const k of CLAVES_TEC) { tec[k] = +(l.reduce((a, q) => a + q.tec[k], 0) / l.length).toFixed(3); mx[k] = +l.reduce((a, q) => Math.max(a, q.tec[k]), 0).toFixed(2); }
  const tiras = new Set(l.map(q => q.cult.join(''))), rasgos = RASGOS.map((r, i) => { const n = new Array(r.valores.length).fill(0); for (const q of l) n[q.cult[i]]++; const m = n.indexOf(Math.max(...n)); return {id: r.id, comun: m, parte: +(n[m] / l.length).toFixed(2)}; });
  return {tec, tecMax: mx, maneras: tiras.size, rasgos}; }

// ---------- NACER ----------
function nacer(M, esp, x, z, w, tam, madre, de) {
  const A = {id: M.nId++, esp, F: FIJO[esp], x: envolver(x), z: envolver(z), rumbo: R() * TAU, v: 0, vivo: true, hambre: madre ? 0.45 : 0.2 + R() * 0.3, sed: madre ? 0.4 : 0.2 + R() * 0.3, cansancio: 0.2, salud: 1,
    tEmb: 0, tSusto: 0, susDe: null, tDec: R() * 0.5, accion: 0, o: {giro: 0, vel: 0, accion: 0}, w, tam, edad: madre ? 0 : 600 + R() * 1200, cria: 0, gen: madre ? madre.gen + 1 : 0, hijos: 0, presas: 0, que: 'anda', remera: madre ? madre.remera : R(), fam: 0, cuerpo: (madre ? 0.4 : 1) * M.R.esp[esp].carne * tam, ...de,
    red: crearRed(w, N_ENT, N_ACC)};
  A.red.reiniciar(); M.pob[esp].push(A); if (madre) M.cuenta.nacen[esp] = (M.cuenta.nacen[esp] || 0) + 1; return A;
}
// uno de la gente. K = la lista en la que queda anotado (un lugar, o M.sueltos): NO es su tribu, es solo donde volvio la ultima vez
// (ver «LOS LUGARES»). o: {x, z, w (su red; si falta o es de otra forma, la semilla), gen, edad, hambre..., imita, lleva, padres,
//   marca (sus GENES, lo que hereda), remera (lo que se ve de lejos), casa {x, z} (el lugar que recuerda), celo, vigor,
//   ficha: lo que el JUEGO sabe de el (su aspecto): aca no se usa, se lleva y se devuelve}
function nuevaGente(M, K, o = {}) {
  const esp = o.esp || K.esp, w = redGente(o.w) || pesosHijos(redGente(M.semillasG?.[esp]) || M.semillaG), x = envolver(o.x ?? K.x + (R() - 0.5) * 8), z = envolver(o.z ?? K.z + (R() - 0.5) * 8);
  const s = {id: M.nId++, K, esp, F: FIJO[esp], x, z, rumbo: R() * TAU, v: 0, vivo: true, tam: o.tam ?? M.R.esp[esp].tam, marca: o.marca ?? (K.suelto ? R() : vuelta(K.marca + gauss() * 0.06)), remera: o.remera ?? (K.suelto ? R() : K.marca),
    casa: o.casa ? {x: o.casa.x, z: o.casa.z} : {x: K.suelto ? x : K.x, z: K.suelto ? z : K.z}, cuerpo: o.cuerpo ?? (o.edad === 0 ? 0.4 : 1) * M.R.esp[esp].carne * (o.tam ?? M.R.esp[esp].tam), cult: o.cult ? Uint8Array.from(o.cult) : cultDe(K.cult0), tec: tecDe(esp, o.tec), cantimplora: o.cantimplora || 0, tCult: R() * 20, tTec: R() * 60, casaComida: 0, celo: o.celo || 0, vigor: o.vigor ?? 1, tQuiere: 0, pareja: null, lug: null,
    hambre: o.hambre ?? 0.15 + R() * 0.3, sed: o.sed ?? 0.15 + R() * 0.3, cansancio: o.cansancio ?? 0.2, salud: o.salud ?? 1, tEmb: 0, tSusto: 0, susDe: null, tDec: R() * 0.5, accion: 0, o: {giro: 0, vel: 0, accion: 0},
    w, red: crearRed(w, N_ENT_G, N_ACC_G), edad: o.edad ?? 1000, gen: o.gen || 0, hijos: 0, presas: 0, que: 'anda', lleva: o.lleva || 0, imita: o.imita ?? 0.3 + R() * 0.4, tImita: R() * 60,
    padres: o.padres || null, ficha: o.ficha || null, caza: false, meDieron: 0, meAtaco: 0, tHace: 0, oye: null, mate: null, atrapado: 0};
  s.red.reiniciar(); K.gen = Math.max(K.gen || 0, s.gen); K.miembros.push(s); return s;
}
// ---------- LOS LUGARES (09-10, Fabri: "los campamentos no deberian estar hardcodeados") ----------
// Un LUGAR (M.tribus, por el nombre de antes) es un sitio del mapa -una ruina, en el juego- con tres ventajas FISICAS, para el que
// este ahi, sea quien sea:  SOMBRA (a menos de 8 m da menos sed, y lo que se deja se pudre 4 veces mas despacio) · REPARO (quieto
// ahi adentro, el que caza no lo ve a mas de 6 m: lo mismo que la mata grande para el cerdo) · ALJIBE (junta el agua de la lluvia,
// y se gasta al tomar). NADIE ES DE UN LUGAR. Cada uno RECUERDA un sitio (su «casa»: donde nacio, o donde dejo comida la ultima
// vez) y siente para donde queda. Si muchos vuelven al mismo, eso es un campamento: K.miembros es solo esa cuenta (los que hoy
// recuerdan ese lugar), y de ahi salen su especie, su comida (la que hay tirada ahi) y su color, para el que mira.
function campo(M, o) { const K = {id: M.nId++, x: envolver(o.x), z: envolver(o.z), miembros: [], esp: o.esp ?? null, estetica: o.estetica ?? null, agresiva: !!o.agresiva, comida: 0, gen: o.gen || 0, plId: o.plId, cultura: o.cultura || null, marca: o.marca ?? R(), agua: o.agua ?? 0.6, cult0: cultAzar()};   /* (cult0: las costumbres con las que arranca el grupo que se ponga aca) */
  M.tribus.push(K); if (o.comida > 0) dejar(M, K.x, K.z, o.comida * 3, 0); return K; }
// PONER un lugar que viene de otro lado (el juego: una ruina); los que arrancan ahi, con ponerGente
export function ponerTribu(M, o) { return campo(M, o); }
export function ponerGente(M, K, lista) { for (const e of lista) { const s = nuevaGente(M, K, {...e, x: undefined, z: undefined}); if (e.hijoDeDos) s.padres = [0, 0]; } return K; }
const delPozo = (M, esp) => { const b = M.bancoG[esp], l = b.length ? b : M.pozo?.[esp]; if (!l || !l.length) return {}; const p = l[Math.floor(R() * l.length)]; return {w: pesosHijos(p.w), imita: p.imita, gen: p.gen || 0, tam: p.tam}; };
function poblar(M, K, esp) { K.esp = esp; K.estetica = esp === 'arana' ? null : ['hippie', 'punk', 'cyber'][Math.floor(R() * 3)]; for (let i = 0, n = esp === 'arana' ? 9 : 6; i < n; i++) nuevaGente(M, K, delPozo(M, esp)); }
// los que LLEGAN de afuera cuando una especie de gente se extinguio: un grupo, junto a un oasis, sin lugar
function llegaGente(M, esp) { if (!M.oasis.length) return; const oa = M.oasis[Math.floor(R() * M.oasis.length)], rem = R(), cu = cultAzar(), a = R() * TAU, cx = oa.x + Math.cos(a) * (oa.R + 15), cz = oa.z + Math.sin(a) * (oa.R + 15);
  for (let i = 0, n = esp === 'arana' ? 9 : 6; i < n; i++) nuevaGente(M, M.sueltos, {...delPozo(M, esp), esp, x: cx + (R() - 0.5) * 10, z: cz + (R() - 0.5) * 10, remera: rem, cult: cultDe(cu), marca: vuelta(rem + gauss() * 0.06), casa: {x: cx, z: cz}}); }
function mundoVacio(o) {
  const M = {t: 0, nId: 1, R: mezclar(recetaBase(), o.receta), oasis: [], celdas: new Map(), pob: {}, steves: [], porEsp: {steve: [], arana: []}, tribus: [], sueltos: {id: 0, suelto: true, miembros: [], esp: null, gen: 0, agua: 0, comida: 0}, cuerpos: [], telas: [], rastros: [], gigante: null, semillas: o.semillas, semillasG: o.semillasG || null, pozo: o.pozo || null, banco: {}, bancoG: {steve: [], arana: []}, quiere: {}, quiereG: {}, obst: [], ev: [],
    semillaG: o.semillas?.cerdo ? semillaGente(o.semillas.cerdo) : null, cuenta: {nacen: {}, nacenMatas: 0, muertes: {}, llegadas: {}, hizo: {}}};
  for (const k of ANIMALES) { M.pob[k] = []; M.banco[k] = []; }
  const N = L / CELDA; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) M.celdas.set(i + ',' + j, []);
  return ajustar(M);
}
// todas las listas de gente: las de los lugares y la de los que no recuerdan ninguno
export const grupos = M => [...M.tribus, M.sueltos];
// opciones: {receta (parcial), semillas: {cerdo: pesos, coyote: pesos}, semillasG: {steve: pesos, arana: pesos} (la red con la que arranca la gente; si falta, la del cerdo agrandada), n: {cerdo, coyote}, tribus: {steve, arana} (cuantos grupos arrancan, cada uno en un lugar),
//   sinLlegadas (true = si una especie se extingue, NO llega nadie de afuera: para medir cuanto aguanta de verdad), lugares (cuantos lugares vacios mas), nOasis, gigante, oasis: [{x, z, R}] (los oasis, ya puestos: los del juego),
//   pozo: de donde salen los primeros, si se arranca desde otro mundo: {cerdo, coyote: [{w, tam, gen}], steve, arana: [{w, imita, gen, tam}], mata: [genes con su red]}}
export function crearMundo(o = {}) {
  const M = mundoVacio(o); M.sinLlegadas = !!o.sinLlegadas;
  if (o.oasis) for (const q of o.oasis) M.oasis.push({x: envolver(q.x), z: envolver(q.z), R: q.R}); else for (let i = 0; i < (o.nOasis ?? 3); i++) M.oasis.push({x: X0 + R() * L, z: X0 + R() * L, R: 4 + R() * 3});
  for (const [id, l] of M.celdas) { const [i, j] = id.split(',').map(Number), n = Math.max(1, Math.round(M.R.flora.matas * aguaDe(M, X0 + (i + 0.5) * CELDA, X0 + (j + 0.5) * CELDA)));
    for (let k = 0; k < n; k++) { const t = 0.3 + R() * 0.5; l.push({x: X0 + (i + R()) * CELDA, z: X0 + (j + R()) * CELDA, comida: t * (0.5 + R() * 0.5), tam: t, res: 0, semE: 0, R: 3, g: mataNueva(M)}); } }
  for (const oa of M.oasis) for (let k = 0; k < 10; k++) { const a = R() * TAU, d = oa.R + 4 + R() * 45, x = envolver(oa.x + Math.cos(a) * d), z = envolver(oa.z + Math.sin(a) * d); celdaDe(M, x, z).push({x, z, comida: 0.4 + R() * 0.6, R: 3, g: mataNueva(M)}); }
  for (const k of ANIMALES) { const n = o.n?.[k] ?? 0; M.quiere[k] = n > 0; for (let i = 0; i < n; i++) { const oa = M.oasis.length ? M.oasis[i % M.oasis.length] : {x: X0 + R() * L, z: X0 + R() * L}, p = o.pozo?.[k]?.length ? o.pozo[k][i % o.pozo[k].length] : null;
      nacer(M, k, oa.x + (R() - 0.5) * 80, oa.z + (R() - 0.5) * 80, Float32Array.from(p ? p.w : o.semillas[k]), p ? p.tam : M.R.esp[k].tam, null, p ? {gen: p.gen || 0} : null); } }
  if (o.gigante) M.gigante = {x: X0 + R() * L, z: X0 + R() * L, rumbo: R() * TAU, tGiro: 200, tPaso: 0, lado: 1, v: 3};
  const sitio = () => { const oa = M.oasis.length ? M.oasis[Math.floor(R() * M.oasis.length)] : null, a = R() * TAU, d = 60 + R() * 160; return {x: oa ? oa.x + Math.cos(a) * d : X0 + R() * L, z: oa ? oa.z + Math.sin(a) * d : X0 + R() * L}; };   // (a la vista de un oasis)
  let nG = 0; if (M.semillaG) for (const esp of TRIBALES) { M.quiereG[esp] = (o.tribus?.[esp] ?? 0) > 0; for (let k = 0; k < (o.tribus?.[esp] ?? 0); k++) { poblar(M, campo(M, {...sitio(), comida: 0.3}), esp); nG++; } }
  for (let k = 0, n = o.lugares ?? Math.ceil(nG * 0.7); k < n; k++) campo(M, sitio());   // (lugares vacios: nadie los fundo; estan)
  return M;
}
const celdaDe = (M, x, z) => M.celdas.get(Math.floor((envolver(x) - X0) / CELDA) + ',' + Math.floor((envolver(z) - X0) / CELDA));
export function aguaDe(M, x, z) { let d = 1e9; for (const o of M.oasis) d = Math.min(d, Math.hypot(env(o.x - x), env(o.z - z)) - o.R); return 0.28 + 0.72 * Math.exp(-Math.max(0, d) / 60); }
function matasCerca(M, x, z, max, cb) { const N = L / CELDA, i0 = Math.floor((x - max - X0) / CELDA), i1 = Math.floor((x + max - X0) / CELDA), j0 = Math.floor((z - max - X0) / CELDA), j1 = Math.floor((z + max - X0) / CELDA);
  if (i1 - i0 + 1 >= N && j1 - j0 + 1 >= N) { for (const l of M.celdas.values()) for (const p of l) cb(p); return; }
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = M.celdas.get(((i % N) + N) % N + ',' + ((j % N) + N) % N); if (l) for (const p of l) cb(p); } }
// LA REJILLA DE LA GENTE: con cientos de Steves y arañas, que cada uno mire a todos los demas es lo que mas cuesta. Se los reparte
// en casilleros de ~90 m (una vez por paso) y cada uno mira solo los de alrededor. genteCerca llama cb(q) con los que PUEDEN estar a
// menos de r (el que llama mide la distancia de verdad)
const NR = Math.max(1, Math.floor(L / 90)), TR = L / NR;
function armarRejilla(M) { const g = M.rej || (M.rej = Array.from({length: NR * NR}, () => [])); for (const c of g) c.length = 0; for (const s of M.steves) g[Math.max(0, Math.min(NR - 1, Math.floor((s.x - X0) / TR))) + NR * Math.max(0, Math.min(NR - 1, Math.floor((s.z - X0) / TR)))].push(s); }
function genteCerca(M, x, z, r, cb) { const k = Math.ceil(r / TR); if (2 * k + 1 >= NR) { for (const s of M.steves) cb(s); return; } const ci = Math.floor((x - X0) / TR), cj = Math.floor((z - X0) / TR), g = M.rej;
  for (let j = cj - k; j <= cj + k; j++) for (let i = ci - k; i <= ci + k; i++) { const l = g[((i % NR) + NR) % NR + NR * (((j % NR) + NR) % NR)]; for (let n = 0; n < l.length; n++) cb(l[n]); } }
// los de una especie que pueden estar a menos de r (los animales son pocos: todos; la gente, por la rejilla)
function cercaDe(M, k, x, z, r, cb) { const l = M.pob[k]; if (l) { for (let n = 0; n < l.length; n++) cb(l[n]); return; } genteCerca(M, x, z, r, q => { if (q.esp === k) cb(q); }); }
// LOS OBSTACULOS (M.obst: rectangulos girados {x, z, hx, hz, co, si} -las ruinas del juego-): nadie los atraviesa. Al que queda adentro
// se lo saca por el lado mas cercano
function fueraDeObstaculos(M, e) { for (const o of M.obst) { const dx = env(e.x - o.x), dz = env(e.z - o.z); if (Math.abs(dx) > o.r || Math.abs(dz) > o.r) continue;
    const lx = dx * o.co - dz * o.si, lz = dx * o.si + dz * o.co, W = o.hx + 0.6, H = o.hz + 0.6; if (Math.abs(lx) >= W || Math.abs(lz) >= H) continue;
    let nx = lx, nz = lz; if (W - Math.abs(lx) < H - Math.abs(lz)) nx = lx < 0 ? -W : W; else nz = lz < 0 ? -H : H;
    e.x = envolver(o.x + nx * o.co + nz * o.si); e.z = envolver(o.z - nx * o.si + nz * o.co); } }
export function ponerObstaculos(M, lista) { M.obst = lista.map(o => ({...o, r: Math.hypot(o.hx, o.hz) + 1.5})); }
// lo que el juego quiere saber que paso (para sonar): se junta aca y el que mira lo vacia
const avisar = (M, t, a, b) => { if (M.ev.length < 300) M.ev.push({t, a, b}); };
// los vivos de una especie (animal o gente)
const losDe = (M, k) => M.pob[k] || M.porEsp[k];
const hizo = (M, A, que) => { const k = A.esp + ': ' + que; M.cuenta.hizo[k] = (M.cuenta.hizo[k] || 0) + 1; };
// el lugar que hay a menos de r de un punto (el mas cercano), o null
function lugarDe(M, x, z, r) { let m = null, dm = r; for (const K of M.tribus) { const d = Math.hypot(env(K.x - x), env(K.z - z)); if (d < dm) { dm = d; m = K; } } return m; }
// DEJAR comida en el suelo: se junta con la que ya hay a 2 m. de = quien la dejo (0 = nadie). A la sombra de un lugar se pudre mas despacio
function dejar(M, x, z, carne, de) { for (const c of M.cuerpos) if (c.carne > 0 && Math.hypot(env(c.x - x), env(c.z - z)) < 2) { c.carne += carne; if (de) c.de = de; return c; }
  const c = {x: envolver(x), z: envolver(z), carne, de, sombra: !!lugarDe(M, x, z, 8)}; M.cuerpos.push(c); return c; }
export function morir(M, A, causa, carne) { if (!A.vivo) return; A.vivo = false; A.muerte = causa; const k = A.esp + ': ' + causa; M.cuenta.muertes[k] = (M.cuenta.muertes[k] || 0) + 1;
  const c = carne ?? ((A.cuerpo ?? 0) + (A.lleva || 0) + (1 - Math.min(1, A.hambre)) * barriga(M, A));   /* (la carne que llego a hacerse, lo que llevaba y lo que tenia en la barriga: como en los Bibites, «body energy plus its stored energy») */ if (c > 0) { A.carcasa = {x: A.x, z: A.z, carne: c, esp: A.esp, caza: causa.startsWith('lo mato'), sombra: !!lugarDe(M, A.x, A.z, 8)}; M.cuerpos.push(A.carcasa); } avisar(M, 'muere', A, causa); }
const matar = morir;
// CON CUANTO CUERPO CUENTA: el suyo y el de los de su especie que tiene a 15 m
const grupoDe = (M, A) => { let g = 0; for (const q of losDe(M, A.esp)) if (q.vivo && dist(A, q) < 15) g += talla(q); return g || talla(A); };
// UNA PRESA, a los sentidos del que la come: es COMIDA en la medida en que es mas chica que uno y los suyos juntos; y lo que le sobra
// de grande, si lastima, es PELIGRO. (Asi el coyote solo le escapa al cerdo grande y va a la cria, y tres juntos lo ven como comida.)
function marcarPresa(M, x, A, q, Rm) { const f = Math.min(1, A.grupo * 0.9 / talla(q)); marcarEn(x, 9, A, q, Rm, f); if (f < 1 && M.R.esp[q.esp].mordida > 0) marcarEn(x, 9 + 16, A, q, 12, 1 - f); }   /* (peligro solo de cerca: para no meterse, no para huir de lejos) */
// lo rapido que puede ir hoy (la cria, menos; el que carga, menos)
const vHoy = (M, A) => M.R.esp[A.esp].v * (0.6 + 0.4 * Math.min(1, A.edad / 600)) / (1 + 0.8 * (A.lleva || 0) / talla(A));
// EL RAPIDO ESQUIVA: un golpe le llega a otro segun lo rapidos que son los dos (igual de rapidos, la mitad de las veces; al doble de rapido, una de cada tres). El atrapado en una tela no esquiva nada
const llega = (M, A, q) => q.atrapado > 0 || R() < 2 * vHoy(M, A) / (vHoy(M, A) + vHoy(M, q)) * 0.5;
function marcarEn(out, base, P, e, Rm, f = 1) { const [dx, dz] = dif(P, e), d = Math.hypot(dx, dz); if (d > Rm || d < 1e-3) return;
  const s = Math.floor(((ang(Math.atan2(dx, dz) - P.rumbo) + Math.PI) / TAU) * SECT) % SECT, k = base + s; out[k] = Math.max(out[k], (1 - d / Rm) * f); }
const _x = new Float32Array(N_ENT), _xg = new Float32Array(N_ENT_G);
const enAgua = (M, A) => M.oasis.some(q => dist(A, q) < q.R + 1.5);
// tiene agua para tomar aca: un oasis, o el aljibe de un lugar (si le queda)
const aljibeAca = A => A.lug && A.lug.agua > 0.01 && dist(A, A.lug) < 3.5;
// LOS SENTIDOS, iguales para todos los animales: su cuerpo (9) + 8 direcciones x 6 canales: comida, agua, peligro, gente, gigante, los suyos
// (como se siente una presa: ver marcarPresa)
function sentir(M, A) {
  const x = _x, V = A.F.vista, C = M.R.come[A.esp], tl = talla(A); x.fill(0); x[0] = A.hambre; x[1] = A.sed; x[2] = A.cansancio; x[3] = A.salud;
  A.lug = lugarDe(M, A.x, A.z, 8); x[4] = enAgua(M, A) || aljibeAca(A) ? 1 : 0; A.hayCarne = false; A.grupo = M.caza[A.esp].length ? grupoDe(M, A) : tl;
  let tapado = false;
  if (C.pasto > 0) matasCerca(M, A.x, A.z, V[0], p => { const c = comible(M, p), d = dist(A, p); if (d < p.R) { if (c > 0.15) x[5] = 1; if ((p.tam || 1) >= 2) tapado = true; } if (c > 0.2) marcarEn(x, 9, A, p, V[0]); });
  A.oculto = tapado && A.v < 0.8;   // EL REFUGIO: adentro de una mata grande y quieto, el que caza no lo ve a mas de 6 m (Huffaker 1958: sin refugio, el cazador extermina)
  if (C.carne > 0) for (const c of M.cuerpos) if (c.carne > 0.05) { const d = dist(A, c); if (d < 2) x[5] = 1; if (d < 30) A.hayCarne = true; marcarEn(x, 9, A, c, V[0]); }
  if (!A.hayCarne) for (const k of M.caza[A.esp]) cercaDe(M, k, A.x, A.z, V[0], q => { if (q.vivo && q !== A && (!q.oculto || dist(A, q) < 6)) marcarPresa(M, x, A, q, V[0]); });   /* (las presas vivas, salvo que ya tenga carne al lado: con comida servida no sale a matar otra) */
  const h = (M.t % DIA) / DIA * TAU; x[6] = Math.sin(h); x[7] = Math.cos(h); x[8] = A.v / M.R.esp[A.esp].v;
  for (const o of M.oasis) marcarEn(x, 9 + 8, A, o, M.R.olfatoAgua); for (const K of M.tribus) if (K.agua > 0.05) marcarEn(x, 9 + 8, A, K, 60);   // (el aljibe de un lugar se huele de cerca)
  for (const k of M.loCazan[A.esp]) for (const q of M.pob[k]) if (q.vivo && q !== A) marcarEn(x, 9 + 16, A, q, V[2]);
  genteCerca(M, A.x, A.z, V[3], s => marcarEn(x, 9 + 24, A, s, V[3]));
  if (M.gigante) marcarEn(x, 9 + 32, A, M.gigante, V[4]);
  { let sS = 0, sC = 0, nS = 0, pS = 0; for (const q of M.pob[A.esp]) if (q.vivo && q !== A) { const p = parecidoM(A.remera, q.remera); marcarEn(x, 9 + 40, A, q, V[5], 0.3 + 0.7 * p); if (dist(A, q) < 15) { sS += Math.sin(q.remera * TAU); sC += Math.cos(q.remera * TAU); nS++; pS += p; } }
    A.fam = nS ? pS / nS * Math.min(1, nS / 3) : 0; if (nS) A.remera = haciaC(A.remera, vuelta(Math.atan2(sS, sC) / TAU), Math.min(0.02, 0.0015 * nS)); }   /* (LOS CONOCIDOS: el olor se contagia, y se nota) */
  if (A.llamado && A.llamado.t > 0) { const [dx, dz] = dif(A, A.llamado), sct = Math.floor(((ang(Math.atan2(dx, dz) - A.rumbo) + Math.PI) / TAU) * SECT) % SECT; x[9 + 40 + sct] = 1; }
  return x;
}
// LOS REFLEJOS (innatos, no son red; mandan solo a pocos metros):
//  - HUIR (10-10, Fabri: "que huya solo cuando esta a punto de morir"): nadie huye por un golpe. El que queda con menos de un tercio
//    de la salud despues de uno, huye 12 segundos del que se lo dio. Vale para todos
//  - la presa: con uno que VIENE CAZANDO (o acaba de morder) a menos de 8 m -a ella o a otro de al lado: asi se defiende la manada-, lo encara quieta y lo embiste si lo tiene a tiro
//  - el cazador (SOLO EL COYOTE; 11-10: la gente ya no caza por reflejo, atacar lo decide su red: asi, cuando la presa escasea, la caza
//    afloja sola en vez de perseguirla hasta la ultima -hiperpredacion, Courchamp 2000-): con hambre y una presa a menos de 12 m, se le tira encima y muerde... SI SE ANIMA: se anima con lo
//    que es mas chico que el y todos los suyos que tiene a 15 m, juntos (Carbone 1999: los que cazan en grupo cazan presas del peso
//    del grupo). Uno solo salta sobre la cria; a la presa grande solo se le animan de a varios. Si despues GANAN, lo dicen los cuerpos.
//    El que esta A PUNTO DE MORIR (menos de un tercio de la salud) no se tira, y el que esta muy cansado, tampoco
function reflejo(M, A) {
  if (A.tSusto > 0 && A.susDe) { const [dx, dz] = dif(A.susDe, A); return {giro: lim(ang(Math.atan2(dx, dz) - A.rumbo) * 2), vel: 1, accion: 0}; }
  let cerca = null, dm = 8; for (const k of M.loCazan[A.esp]) for (const y of M.pob[k]) if (y.vivo && y !== A && (y.caza || y.tEmb > 0)) { const d = dist(A, y); if (d < dm) { dm = d; cerca = y; } }   /* (solo al que VIENE cazando o acaba de morder: al coyote que pasa o toma agua al lado, no) */
  if (M.genteLoCaza[A.esp].length) genteCerca(M, A.x, A.z, 8, s => { if (s.tEmb > 0 && s !== A && !(s.tSusto > 0) && M.R.come[s.esp][A.esp] > 0) { const d = dist(A, s); if (d < Math.min(dm, 6)) { dm = d; cerca = s; } } });
  if (cerca) { const [dx, dz] = dif(A, cerca), a = ang(Math.atan2(dx, dz) - A.rumbo); return {giro: lim(a * 2), vel: 0.05, accion: dm < 3.5 && Math.abs(a) < 0.8 ? 3 : 0}; }
  if (!A.K && M.caza[A.esp].length && A.hambre > M.R.esp[A.esp].hambreCaza && !A.hayCarne && A.salud > 0.35 && A.cansancio < 0.7) { let pr = null, dp = 12; const tope = (A.grupo || talla(A)) * 0.9; for (const k of M.caza[A.esp]) {
      cercaDe(M, k, A.x, A.z, 12, q => { if (q.vivo && q !== A && talla(q) <= tope && (!q.oculto || dist(A, q) < 6)) { const d = dist(A, q); if (d < dp) { dp = d; pr = q; } } }); }
    if (pr) { const [dx, dz] = dif(A, pr); return {giro: lim(ang(Math.atan2(dx, dz) - A.rumbo) * 2), vel: 1, accion: dp < 1.5 + A.v * 0.1 ? 3 : 0, caza: true}; } }
  return null;
}
// EL GOLPE (la accion 3, "embestir / atacar"): arranca de frente. CUANTO LASTIMA sale de los dos cuerpos: su mordida por su
// tamaño de hoy, sobre el tamaño del otro. No hay regla de quien le gana a quien: el coyote es chico y rapido, asi que a un
// lechon lo mata de un mordisco, a un cerdo grande le hacen falta varios -o varios coyotes-, y el cerdo, que tambien lastima
// cuando embiste, a un coyote solo lo voltea en dos golpes.
//  - al que se lo come y tiene enfrente: si tiene con que, lo lastima
//  - a su presa -y, la gente, a cualquiera que tenga enfrente-: la lastima. La presa que encara frena la mitad; el atrapado en una tela no esquiva nada
function golpe(M, A, E, F) {
  A.tEmb = 1.5; A.v = Math.max(A.v, F.embiste); A.cansancio = Math.min(1, A.cansancio + 0.04);
  const fx = Math.sin(A.rumbo), fz = Math.cos(A.rumbo), alFrente = (q, r) => { const [dx, dz] = dif(A, q), d = Math.hypot(dx, dz); return d < r && dx * fx + dz * fz > 0 && Math.abs(ang(Math.atan2(dx, dz) - A.rumbo)) < 0.8 ? d : 0; }, tl = talla(A) * (A.K ? 1 + 0.8 * A.tec.punta : 1);   /* (LA PUNTA: el que sabe hacerla pega mas fuerte) */
  let blanco = null, db = 9; for (const k of M.loCazan[A.esp]) for (const y of M.pob[k]) if (y.vivo && y !== A) { const d = alFrente(y, 3.5); if (d && d < db) { db = d; blanco = y; } }
  if (M.genteLoCaza[A.esp].length) genteCerca(M, A.x, A.z, 4, s => { if (s.vivo && s !== A && s.tEmb > 0 && M.R.come[s.esp][A.esp] > 0) { const d = alFrente(s, 3.5); if (d && d < db) { db = d; blanco = s; } } });
  if (blanco) {
    if (E.mordida > 0 && db < 2.8 && llega(M, A, blanco)) { blanco.salud -= E.mordida * tl / talla(blanco); if (blanco.salud < 0.35) { blanco.tSusto = 12; blanco.susDe = {x: A.x, z: A.z}; } if (blanco.K) blanco.meAtaco = 1; avisar(M, 'golpe', A, blanco); if (blanco.salud <= 0) matar(M, blanco, 'lo mato un ' + A.esp + ' que se defendia'); } }
  if (!(E.mordida > 0)) return;
  let pr = null, dp = 9; for (const k of M.caza[A.esp]) cercaDe(M, k, A.x, A.z, 3, q => { if (q.vivo && q !== A) { const d = alFrente(q, 2.4); if (d && d < dp) { dp = d; pr = q; } } });
  if (A.K && !pr) genteCerca(M, A.x, A.z, 3, q => { if (q.vivo && q !== A && !(q.esp === A.esp && A.cult[6] === 1)) {   /* (el que TOLERA al extraño no le pega a los de su especie) */ const d = alFrente(q, 2.4); if (d && d < dp) { dp = d; pr = q; } } });   // (la gente: a CUALQUIERA que tenga enfrente, sea su comida o no, se le parezca o no)
  if (!pr) return; if (A.K) hizo(M, A, !pr.K ? 'ataco a un animal' : pr.esp !== A.esp ? 'ataco a uno de otra especie' : parecidoM(A.remera, pr.remera) > 0.75 ? 'ataco a uno de su misma remera' : 'ataco a uno de otra remera'); avisar(M, 'golpe', A, pr);
  if (!llega(M, A, pr)) return;
  pr.salud -= E.mordida * tl / talla(pr); if (pr.salud < 0.35) { pr.tSusto = 12; pr.susDe = {x: A.x, z: A.z}; } if (pr.K) pr.meAtaco = 1;
  if (pr.salud <= 0) { matar(M, pr, 'lo mato un ' + A.esp); A.presas++; }
}
// EL CUERPO, el mismo para todos: hambre, sed, cansancio, salud, vejez. Devuelve false si se murio. (vigor: el tope de salud; lo baja nacer de dos casi iguales)
function cuerpo(M, A, E, dt, a) {
  const bien = 1 + (A.fam || 0);   // (con conocidos al lado se descansa y se cura mejor)
  if (a === 1 && A.v < 0.4) { A.cansancio = Math.max(0, A.cansancio - dt * 0.012 * bien); if (A.hambre < 0.6 && A.sed < 0.6) A.salud = Math.min(A.vigor ?? 1, A.salud + dt / 300 * bien); }
  else if (A.v < 0.3 * E.v) A.cansancio = Math.max(0, A.cansancio - dt * 0.003 * bien);   // (09-10: quieto o al paso tambien se recupera, mas despacio que echado)
  if (A.hambre >= 1 || A.sed >= 1) A.salud -= dt / 150; if (A.cansancio >= 1) A.salud -= dt / 400;
  if (A.edad > E.vida) A.salud -= dt / 300;
  if (A.salud <= 0) { morir(M, A, A.edad > E.vida ? 'vejez' : A.hambre >= 1 ? 'hambre' : A.sed >= 1 ? 'sed' : A.cansancio >= 1 ? 'agotamiento' : 'heridas'); return false; }
  return true;
}
// LO QUE GASTA un cuerpo por segundo, respecto de uno comun quieto: el grande gasta mas (Kleiber), el que corre gasta mas
// (con el cuadrado de la velocidad: ser rapido no es gratis), y el que carga, mas
const gastoDe = (M, A) => { const tl = talla(A); return Math.pow(tl, M.R.costoTam) * (1 + 0.2 * (A.v / 5) ** 2) * (1 + 0.5 * (A.lleva || 0) / tl); };
// LA BARRIGA EN ENERGIA: una barriga llena de un bicho de tamaño 1 guarda lo que le rinde su MEJOR comida (el cerdo, 1/1.6 de pasto;
// el que come carne, 1/2.5 de carne). Lo que come de una comida que le rinde menos (el Steve con el pasto) lo aprovecha en parte: el
// resto vuelve a la energia libre (la «dieta» de los Bibites: el que digiere bien la carne digiere mal la planta)
const barriga = (M, A) => { const C = M.R.come[A.esp]; return talla(A) / Math.max(C.pasto, C.carne, 0.01); };
// COMER k de energia de una comida: baja el hambre lo que esa comida le rinde; y mientras se esta haciendo el cuerpo, una parte
// (eficiencia) de eso va a carne propia EN VEZ de a la barriga (no ademas: la energia no se crea)
function ingerir(M, A, k, rinde) { const tl = talla(A), tope = M.R.esp[A.esp].carne * A.tam, aCuerpo = (A.cuerpo || 0) < tope ? M.R.eficiencia : 0;
  A.cuerpo = Math.min(tope, (A.cuerpo || 0) + aCuerpo * k * rinde / Math.max(M.R.come[A.esp].pasto, M.R.come[A.esp].carne)); A.hambre = Math.max(0, A.hambre - k * rinde * (1 - aCuerpo) / tl); }
// LO QUE CUESTA UNA CRIA (12-10, como el huevo de los Bibites: «they extract energy from its parent»): la energia con la que nace -la
// que trae en la barriga y la de su cuerpo de recien nacido-. La pagan los padres, de su barriga
const costoCria = (M, h) => (1 - h.hambre) * barriga(M, h) + (h.cuerpo || 0);
// comer lo que tiene debajo (la mata, la carne). Devuelve true si comio
function comer(M, A, C, dt, ritmo) {
  let come = false; const tl = talla(A);
  const cruda = A.K ? 0.7 + 0.3 * A.tec.fuego : 1;   // (EL FUEGO: a la gente la carne le rinde 7 de 10; con fuego, hasta todo)
  if (C.pasto > 0 && !(A.K && A.esp === 'steve' && A.cult[0] === 3)) { let mata = null; matasCerca(M, A.x, A.z, 4, p => { if (!mata && comible(M, p) > 0.05 && dist(A, p) < p.R) mata = p; });
    // EL ESTORBO: alrededor de una mata entran pocas bocas (3 en una comun, mas en una grande); si hay mas, se reparten el lugar
    if (mata) { mata.bocas = (mata.bocas || 0) + 1; const lugar = Math.min(1, M.R.flora.bocas * Math.sqrt(mata.tam || 1) / Math.max(1, mata.bocasAnt || 1));
      const e = 1 - 0.7 * (mata.g?.espina || 0), k = Math.max(0, Math.min(comible(M, mata), dt * 0.03 * ritmo * e * tl * lugar)); mata.comida -= k; if (k > 0) { come = true; ingerir(M, A, k, C.pasto); } } }
  if (C.carne > 0 && !come) { const c = M.cuerpos.find(q => q.carne > 0.001 && dist(q, A) < 2.5 && !(A.K && vedada(A, q))); if (c) { const k = Math.min(c.carne, dt * 0.02 * ritmo * tl); c.carne -= k; ingerir(M, A, k, C.carne * cruda); come = true; if (c.de && A.K && c.de !== A.id && (A.tComioAjeno = (A.tComioAjeno || 0) - dt) <= 0) { A.tComioAjeno = 10; hizo(M, A, 'comio de lo que habia dejado otro'); } } }
  return come;
}

// ---------- LA VIDA DE UN ANIMAL ----------
function vivir(M, A, dt) {
  if (A.sujeto) return;   // (lo tiene el jugador -el arpon-: no decide ni se mueve)
  const E = M.R.esp[A.esp], C = M.R.come[A.esp], F = A.F;
  if ((A.tDec -= dt) <= 0) { A.tDec = 0.5; const x = sentir(M, A), o = A.red.paso(x); A.o = M.maestro ? M.maestro(A, x, o) : o; }   /* (M.maestro: para medir o enseñar, otro decide en lugar de la red -ver tools/vivo/maestro.mjs-; en el juego no hay) */
  const rf = reflejo(M, A); let o = rf || A.o; A.caza = !!(rf && rf.caza); if (A.atrapado > 0) { A.atrapado -= dt; o = {giro: 0, vel: 0, accion: 0}; }   /* (en una tela: no se mueve) */
  let a = o.accion; if (a === 1 && A.cansancio < 0.25) a = 0; A.accion = a;
  const vmax = vHoy(M, A);   // (la cria es mas lenta)
  A.rumbo += o.giro * F.giro * dt; A.v += (o.vel * vmax - A.v) * Math.min(1, dt * 3); if (a === 1) A.v *= Math.exp(-dt * 6); if (A.atrapado > 0) A.v = 0;
  if (A.tEmb > 0) A.tEmb -= dt; if (A.tSusto > 0) A.tSusto -= dt;
  if (a === 3 && A.tEmb <= 0) golpe(M, A, E, F);
  mover(A, dt); if (M.obst.length) fueraDeObstaculos(M, A);
  if (a === 2) for (const q of M.pob[A.esp]) if (q.vivo && q !== A && dist(q, A) < 45) q.llamado = {x: A.x, z: A.z, t: 3};
  if (A.llamado) A.llamado.t -= dt;
  const ritmo = A.v < 0.6 ? 1 : 0.3, gasto = gastoDe(M, A); A.edad += dt;
  A.hambre = Math.min(1, A.hambre + dt / E.tHambre * gasto); A.sed = Math.min(1, A.sed + dt / E.tSed * gasto); A.cansancio = Math.min(1, Math.max(0, A.cansancio + dt * (0.0006 + 0.005 * (A.v / E.v) ** 2)));
  const come = A.hambre > 0.05 && comer(M, A, C, dt, ritmo);
  let toma = false; if (A.sed > 0.03) { if (enAgua(M, A)) { A.sed = Math.max(0, A.sed - dt * 0.08 * ritmo); toma = true; } else if (aljibeAca(A)) { A.sed = Math.max(0, A.sed - dt * 0.08 * ritmo); A.lug.agua = Math.max(0, A.lug.agua - dt * 0.004 * ritmo * A.tam); toma = true; } }
  A.que = A.atrapado > 0 ? 'atrapado' : A.tSusto > 0 ? 'huye' : A.tEmb > 1 ? (M.caza[A.esp].length ? 'muerde' : 'embiste') : rf && rf.caza ? 'caza' : rf ? 'encara' : come && A.v < 0.6 ? 'come' : toma && A.v < 0.6 ? 'toma' : a === 1 && A.v < 0.4 ? 'echado' : a === 2 ? 'llama' : A.v > 0.7 * E.v ? 'corre' : 'anda';
  if (!cuerpo(M, A, E, dt, a)) return;
  // LA CRIA: adulto, comido, tomado y sano, va juntando; cuando junta, nace uno al lado con su red, mutada
  if (A.edad > 600 && A.hambre < 0.4 && A.sed < 0.5 && A.salud > 0.8) { A.cria += dt / E.gesta;
    if (A.cria >= 1) { A.cria = 0; A.hijos++; const h = nacer(M, A.esp, A.x + (R() - 0.5) * 3, A.z + (R() - 0.5) * 3, pesosHijos(A.w), tamHijo(A.tam), A); A.hambre = Math.min(1, A.hambre + costoCria(M, h) / barriga(M, A));   /* (LA CRIA LA PAGA LA MADRE: lo que la cria trae en la barriga y en el cuerpo sale de la barriga de ella) */
      const b = M.banco[A.esp]; b.push({w: A.w, tam: A.tam}); if (b.length > 8) b.shift(); } }
}

// ---------- LA VIDA DE LA GENTE (Steve o araña): su red le maneja el cuerpo, como a un animal, con mas piezas ----------
// LOS SENTIDOS: los 57 del animal y 21 mas. En los canales de GENTE no hay "mio / ajeno": cada uno de su especie pesa en
// "los suyos" segun cuanto se parece su REMERA a la de uno, y en "los otros" segun cuanto no; los de otra especie, todo en "los otros".
//   57 cuanto lleva encima · 58 esta en su «casa» (el sitio que recuerda) · 59-60 para donde queda · 61 cuanta comida habia ahi la ultima vez que la vio
//   62-63 la señal A que oye (fuerza, de que lado) · 64-65 la señal B · 66 el hambre del que tiene al lado
//   67 le dieron hace poco · 68 lo atacaron hace poco · 69-70 el rastro (de arañas de remera parecida) adelante a la izquierda / derecha
//   71 hay algo atrapado en una tela cerca · 72 cuanto se le parecen LOS GENES al que tiene al lado (eso se nota solo de cerca)
//   73 su CELO · 74 la salud del que tiene al lado · 75 que tan grande es al lado de uno · 76 hay uno de los suyos que QUIERE, a tiro
//   77 esta en un lugar con reparo
// LOS CONOCIDOS (10-10, Fabri: "que haya cierta tendencia a que se caigan bien mientras mas tiempo pasen juntos... con todos"): lo de la
// remera vale para TODO bicho (en el cerdo y el coyote no es ropa: es el olor del grupo). Y sirve para algo: con conocidos al lado
// (A.fam: cuanto se le parece el olor a los que tiene a 15 m) se descansa y se cura mas rapido, hasta el doble. Nadie esta obligado
// a quedarse con los suyos; al que se queda, le va mejor. En los sentidos, «los suyos» pesa segun ese parecido.
// LA REMERA (09-10, Fabri: "los que vuelven al mismo lugar o viajan historicamente juntos tengan la misma remera"): el color que
// se ve de lejos NO se hereda ni lo da un lugar: se CONTAGIA. Cada uno se va tiñendo del color de los de su especie que tiene
// cerca (a 15 m), de a poco: hacen falta minutos de andar juntos. El hijo nace con la de la madre. Es el olor de colonia de las hormigas.
function sentirGente(M, A) {
  const x = _xg, V = A.F.vista, C = M.R.come[A.esp], tl = talla(A); x.fill(0); x[0] = A.hambre; x[1] = A.sed; x[2] = A.cansancio; x[3] = A.salud;
  A.lug = lugarDe(M, A.x, A.z, 8); x[4] = enAgua(M, A) || aljibeAca(A) ? 1 : 0; A.hayCarne = false; A.grupo = M.caza[A.esp].length ? grupoDe(M, A) : tl;
  if (C.pasto > 0 && !(A.esp === 'steve' && A.cult[0] === 3)) matasCerca(M, A.x, A.z, V[0], p => { const c = comible(M, p); if (c > 0.15 && dist(A, p) < p.R) x[5] = 1; if (c > 0.2) marcarEn(x, 9, A, p, V[0]); });   /* (lo que su costumbre no le deja comer, no lo siente como comida) */
  if (C.carne > 0) for (const c of M.cuerpos) if (c.carne > 0.05 && !vedada(A, c)) { const d = dist(A, c); if (d < 2.5) x[5] = 1; if (d < 30) A.hayCarne = true; marcarEn(x, 9, A, c, V[0]); }
  if (!A.hayCarne) for (const k of M.caza[A.esp]) { if (presaVedada(A, k)) continue; cercaDe(M, k, A.x, A.z, V[0], q => { if (q.vivo && q !== A && (!q.oculto || dist(A, q) < 6)) marcarPresa(M, x, A, q, V[0]); }); }
  const h = (M.t % DIA) / DIA * TAU; x[6] = Math.sin(h); x[7] = Math.cos(h); x[8] = A.v / M.R.esp[A.esp].v;
  for (const o of M.oasis) marcarEn(x, 9 + 8, A, o, M.R.olfatoAgua); for (const K of M.tribus) if (K.agua > 0.05) marcarEn(x, 9 + 8, A, K, 60);
  for (const k of M.loCazan[A.esp]) for (const q of M.pob[k]) if (q.vivo) marcarEn(x, 9 + 16, A, q, V[2]);
  let mate = null, dm = 6, pareja = null, dp = 8, sS = 0, sC = 0, nS = 0, pS = 0;
  genteCerca(M, A.x, A.z, V[3], q => { if (q === A || !q.vivo) return; const d = dist(A, q), p = q.esp === A.esp ? parecidoM(A.remera, q.remera) : 0;
    if (p > 0) marcarEn(x, 9 + 40, A, q, V[5], p); if (p < 1) marcarEn(x, 9 + 24, A, q, V[3], 1 - p); if (M.R.come[q.esp][A.esp] > 0) marcarEn(x, 9 + 16, A, q, V[2]);
    if (q.esp === A.esp && p < 0.5 && A.cult[6] === 0) marcarEn(x, 9 + 16, A, q, 20, 1 - p);   // (el que EVITA al extraño lo siente como peligro, de cerca)
    if (d < dm) { dm = d; mate = q; }
    if (q.esp === A.esp) { if (d < 15) { sS += Math.sin(q.remera * TAU); sC += Math.cos(q.remera * TAU); nS++; pS += p; } if (d < dp && q.tQuiere > 0 && q.edad > 600 && parejaVale(A, q) && parejaVale(q, A)) { dp = d; pareja = q; } } });
  A.fam = nS ? pS / nS * Math.min(1, nS / 3) : 0; if (nS) A.remera = haciaC(A.remera, vuelta(Math.atan2(sS, sC) / TAU), Math.min(0.02, 0.0015 * nS));   // (se tiñe: con 4 al lado, la mitad del camino en unos 4 minutos)
  if (M.gigante) marcarEn(x, 9 + 32, A, M.gigante, V[4]);
  A.mate = mate; A.pareja = pareja; const n = N_ENT, dCasa = dist(A, A.casa);
  if (dCasa < 30) { let s = 0; for (const c of M.cuerpos) if (c.carne > 0 && Math.hypot(env(c.x - A.casa.x), env(c.z - A.casa.z)) < 8) s += c.carne; A.casaComida = Math.min(1, s / 3); }
  x[n] = Math.min(1, A.lleva / tl); x[n + 1] = dCasa < 6 ? 1 : 0; { const [dx, dz] = dif(A, A.casa), a = ang(Math.atan2(dx, dz) - A.rumbo); x[n + 2] = Math.sin(a); x[n + 3] = Math.cos(a); } x[n + 4] = A.casaComida;
  if (A.oye) for (let i = 0; i < 2; i++) { const o = A.oye[i]; if (o && o.t > 0) { const [dx, dz] = dif(A, o), f = o.t / 3; x[n + 5 + 2 * i] = f; x[n + 6 + 2 * i] = Math.sin(ang(Math.atan2(dx, dz) - A.rumbo)) * f; } }
  { const o0 = A.oye && A.oye[0]; if (o0 && o0.t > 0 && o0.aviso) marcarEn(x, [9 + 16, 9, 9 + 40][A.cult[7]], A, o0, 80, o0.t / 3); }   // (EL AVISO: cada uno lo oye segun lo que quiere decir PARA EL -peligro, comida o reunion-, venga de quien venga)
  x[n + 9] = mate ? mate.hambre : 0; x[n + 10] = A.meDieron; x[n + 11] = A.meAtaco;
  if (mate && mate.esp === A.esp) { x[n + 15] = parecidoM(A.marca, mate.marca); x[n + 17] = mate.salud; x[n + 18] = Math.min(1, talla(mate) / tl / 2); }
  x[n + 16] = A.celo; x[n + 19] = pareja ? 1 : 0; x[n + 20] = A.lug ? 1 : 0;
  if (A.esp === 'arana') { let iz = 0, de = 0; for (const m of M.rastros) { const [dx, dz] = dif(A, m), d = Math.hypot(dx, dz); if (d > 15 || d < 0.5) continue; const a = ang(Math.atan2(dx, dz) - A.rumbo); if (Math.abs(a) > 1.6) continue;
      const f = (1 - d / 15) * Math.max(0, 1 - (M.t - m.t) / 300) * parecidoM(A.remera, m.marca); if (a < 0) iz += f; else de += f; }
    x[n + 12] = Math.min(1, iz); x[n + 13] = Math.min(1, de);
    for (const q of M.atrapados) if (q.vivo && q.atrapado > 0 && dist(A, q) < 40) { x[n + 14] = 1; marcarEn(x, 9, A, q, 40); } }
  return x;
}
// APAREARSE (09-10): ya no pasa solo. Hace falta que A lo ELIJA con el celo lleno, y que al lado (8 m) haya un adulto de su
// especie que tambien lo este eligiendo. Pagan los dos lo que cuesta la cria (costoCria). El hijo: la red, mezcla de las dos; los genes, a mitad de camino entre
// los de los dos; el tamaño, el promedio; la remera y la «casa», las de A. EL COSTO DE LO IGUAL: si los genes de los dos son casi
// los mismos, el hijo nace con menos vigor (tope de salud); eso es lo unico que empuja a no elegir siempre al mas parecido.
function aparear(M, A, q) {
  const dg = difC(A.marca, q.marca), vigor = 0.55 + 0.45 * Math.min(1, dg / 0.04);
  A.tHace = 3; A.celo = 0; q.celo *= 0.5; A.hijos++; q.hijos++;
  const h = nuevaGente(M, A.K, {esp: A.esp, x: A.x + (R() - 0.5) * 3, z: A.z + (R() - 0.5) * 3, w: cruzar(A.w, q.w), gen: Math.max(A.gen, q.gen) + 1, edad: 0, hambre: 0.45, sed: 0.4, marca: vuelta(haciaC(A.marca, q.marca, 0.5) + gauss() * 0.03), remera: A.remera, casa: A.lug ? {x: A.lug.x, z: A.lug.z} : {x: A.x, z: A.z},
    tam: tamHijo((A.tam + q.tam) / 2), imita: Math.max(0, Math.min(1, (A.imita + q.imita) / 2 + gauss() * 0.05)), vigor, salud: vigor, cult: A.cult, tec: tecHijo(M, A), padres: [A.id, q.id]});
  { const c = costoCria(M, h); A.hambre = Math.min(1, A.hambre + c * 2 / 3 / barriga(M, A)); q.hambre = Math.min(1, q.hambre + c / 3 / barriga(M, q)); }   // (la pagan los dos: dos tercios el que la tiene, un tercio el otro)
  M.cuenta.nacen[A.esp] = (M.cuenta.nacen[A.esp] || 0) + 1; hizo(M, A, 'tuvo cria con uno de genes ' + (dg < 0.04 ? 'casi iguales' : dg < 0.15 ? 'parecidos' : 'distintos')); hizo(M, A, 'tuvo cria con uno de ' + (parecidoM(A.remera, q.remera) > 0.75 ? 'su misma remera' : 'otra remera'));
  const b = M.bancoG[A.esp]; b.push({w: A.w, imita: A.imita, tam: A.tam, gen: A.gen}); if (b.length > 12) b.shift(); avisar(M, 'nace', A, q);
}
function vivirGente(M, A, dt) {
  if (A.sujeto) return;
  const E = M.R.esp[A.esp], C = M.R.come[A.esp], F = A.F, P = PUEDE[A.esp];
  if ((A.tDec -= dt) <= 0) { A.tDec = 0.5; const x = sentirGente(M, A), o = A.red.paso(x); A.o = M.maestro ? M.maestro(A, x, o) : o; }
  const rf = reflejo(M, A); let o = rf || A.o; A.caza = !!(rf && rf.caza); if (A.atrapado > 0) { A.atrapado -= dt; o = {giro: 0, vel: 0, accion: 0}; }
  let a = o.accion; if (!(P[a] || (a === ACC.tejer && A.tec.trampa >= 0.2)) || (a === 1 && A.cansancio < 0.25)) a = 0;   /* (LA TRAMPA: el Steve que aprendio a hacerla puede ponerlas) */
  // LO QUE SU COSTUMBRE LE DEJA HACER (la red propone; la costumbre habilita o prohibe)
  if ((a === ACC.agarrar || a === ACC.soltar) && A.cult[2] !== 1) a = 0;
  else if (a === ACC.dar) { const q = A.mate; if (A.cult[1] === 2 || !q || (A.cult[1] === 1 && !(q.esp === A.esp && parecidoM(A.remera, q.remera) > 0.75))) a = 0; }
  else if (a === ACC.tejer && A.esp === 'arana' && ((A.cult[9] === 1 && !M.oasis.some(q => dist(A, q) < q.R + 30)) || (A.cult[9] === 2 && !A.lug))) a = 0;
  // al EXTRAÑO (el de su especie con otra remera), el que tiene por costumbre atacarlo le pega cuando lo tiene al lado
  if (A.cult[6] === 2 && A.tEmb <= 0 && A.mate && A.mate.esp === A.esp && A.mate.vivo && parecidoM(A.remera, A.mate.remera) < 0.5 && dist(A, A.mate) < 2.6) { const [dx, dz] = dif(A, A.mate); A.rumbo = Math.atan2(dx, dz); a = ACC.atacar; }
  A.accion = a;
  const tl = talla(A), carga = A.lleva / tl, vmax = vHoy(M, A);   // (CARGAR PESA: con las manos llenas anda a poco mas de la mitad; por eso conviene dejar lo que se lleva en algun lado)
  A.rumbo += o.giro * F.giro * dt; A.v += (o.vel * vmax - A.v) * Math.min(1, dt * 3); if (a === 1) A.v *= Math.exp(-dt * 6); if (A.atrapado > 0) A.v = 0;
  if (A.tEmb > 0) A.tEmb -= dt; if (A.tSusto > 0) A.tSusto -= dt; if (A.tHace > 0) A.tHace -= dt; if (A.tQuiere > 0) A.tQuiere -= dt;
  A.meDieron = Math.max(0, A.meDieron - dt / 20); A.meAtaco = Math.max(0, A.meAtaco - dt / 30); if (A.oye) for (const q of A.oye) if (q) q.t -= dt;
  let gesto = null;
  if (a === ACC.atacar && A.tEmb <= 0) golpe(M, A, E, F);
  else if (a === ACC.aparear) { if (A.edad > 600) A.tQuiere = 6; const q = A.pareja;   // QUERER: se le nota (los demas lo ven). Si el celo esta lleno y hay otro que quiere a tiro, nace uno
    if (A.tHace <= 0 && A.celo >= 1 && q && q.vivo && q.tQuiere > 0 && dist(A, q) < 8) { aparear(M, A, q); gesto = 'aparea'; } }
  else if ((a === ACC.senalA || a === ACC.senalB) && A.tHace <= 0) { A.tHace = 2; const i = a === ACC.senalA ? 0 : 1; gesto = i ? 'senalB' : 'senalA'; hizo(M, A, i ? 'señal B' : 'señal A'); avisar(M, 'senal', A, i);   // LAS SEÑALES: la oyen los de su especie a 60 m. Lo que quieran decir no esta escrito
    genteCerca(M, A.x, A.z, 60, q => { if (q !== A && q.esp === A.esp && dist(q, A) < 60) (q.oye || (q.oye = [null, null]))[i] = {x: A.x, z: A.z, t: 3}; }); }
  else if (a === ACC.dar && A.tHace <= 0 && A.mate && A.mate.vivo && dist(A, A.mate) < 2.5) { const q = A.mate; A.tHace = 3;   // DAR: de lo que lleva; o, si no lleva nada, de lo que tiene comido, al que tiene mas hambre que el
    if (A.lleva > 0.01) { const k = Math.min(A.lleva, 0.2); A.lleva -= k; ingerir(M, q, k, M.R.come[q.esp].carne); q.meDieron = 1; gesto = 'da'; hizo(M, A, 'dio comida'); }
    else if (A.hambre < q.hambre - 0.1) { A.hambre = Math.min(1, A.hambre + 0.12); q.hambre = Math.max(0, q.hambre - 0.12); q.meDieron = 1; gesto = 'da'; hizo(M, A, 'dio comida'); } }
  else if (a === ACC.agarrar && A.tHace <= 0 && A.lleva < tl) { A.tHace = 1;   // AGARRAR lo que hay aca: carne (suelta, o la que dejo alguien) o pasto. Puede cargar hasta su propio tamaño, pero cada kilo lo frena y le da hambre
    const c = M.cuerpos.find(q => q.carne > 0.02 && dist(q, A) < 2.5);
    if (c) { const k = Math.min(c.carne, 0.3); c.carne -= k; A.lleva += k; gesto = 'agarra'; hizo(M, A, !c.de ? 'agarro carne' : c.de === A.id ? 'agarro de lo que habia dejado' : 'agarro de lo que habia dejado otro'); }
    else if (C.pasto > 0 && C.carne > 0) { let mata = null; matasCerca(M, A.x, A.z, 4, p => { if (!mata && comible(M, p) > 0.1 && dist(A, p) < p.R) mata = p; }); if (mata) { const k = Math.min(comible(M, mata), 0.3); mata.comida -= k; A.lleva += k * C.pasto / C.carne; gesto = 'agarra'; hizo(M, A, 'agarro pasto'); } } }
  else if (a === ACC.soltar && A.tHace <= 0 && A.lleva > 0.01) { A.tHace = 1; gesto = 'suelta';   // SOLTAR: queda en el suelo, ahi. Y el sitio se le graba: es su «casa» desde ahora
    const c = dejar(M, A.x, A.z, A.lleva, A.id); c.conserva = Math.max(c.conserva || 0, A.tec.conserva); A.lleva = 0;   /* (CONSERVAR: lo que deja el que sabe, dura mas) */ A.casa = c.sombra && A.lug ? {x: A.lug.x, z: A.lug.z} : {x: c.x, z: c.z}; hizo(M, A, c.sombra ? 'dejo comida en un lugar con reparo' : 'dejo comida al aire'); }
  else if (a === ACC.tejer && A.tHace <= 0) { A.tHace = 20; A.hambre = Math.min(1, A.hambre + 0.01); gesto = 'teje'; hizo(M, A, A.esp === 'arana' ? 'tejio' : 'puso una trampa');   // TEJER: una tela aca. Al que la pisa (que no sea araña) lo deja quieto 4 s
    M.telas.push({x: A.x, z: A.z, de: A.id, esp: A.esp, z0: A.tec.trampa, t: M.t}); let mias = 0; for (const t of M.telas) if (t.de === A.id) mias++; if (mias > 3) M.telas.splice(M.telas.findIndex(t => t.de === A.id), 1); }
  else if (a === ACC.rastro && A.tHace <= 0) { A.tHace = 4; gesto = 'rastro'; hizo(M, A, 'dejo rastro'); M.rastros.push({x: A.x, z: A.z, marca: A.remera, t: M.t}); if (M.rastros.length > 600) M.rastros.shift(); }   // RASTRO: una marca en el suelo; dura 5 minutos
  mover(A, dt); if (M.obst.length) fueraDeObstaculos(M, A);
  A.oculto = !!A.lug && A.v < 0.8;   // EL REPARO de un lugar: quieto ahi adentro, el que caza no lo ve a mas de 6 m
  const ritmo = A.v < 0.6 ? 1 : 0.3, gasto = gastoDe(M, A); A.edad += dt;
  A.hambre = Math.min(1, A.hambre + dt / E.tHambre * gasto); A.sed = Math.min(1, A.sed + dt / E.tSed * gasto * (A.lug ? 0.6 : 1)); A.cansancio = Math.min(1, Math.max(0, A.cansancio + dt * (0.0006 + 0.005 * (A.v / E.v) ** 2)));   /* (LA SOMBRA de un lugar: menos sed) */
  let come = A.hambre > 0.05 && comer(M, A, C, dt, ritmo);
  if (!come && A.lleva > 0 && A.hambre > 0.5) { const k = Math.min(A.lleva, dt * 0.02); A.lleva -= k; ingerir(M, A, k, C.carne * (0.7 + 0.3 * A.tec.fuego)); come = true; }   // (con hambre, come de lo que lleva)
  let toma = false; if (A.sed > 0.03) { if (enAgua(M, A)) { A.sed = Math.max(0, A.sed - dt * 0.08 * ritmo); toma = true; }
    else if (aljibeAca(A)) { A.sed = Math.max(0, A.sed - dt * 0.08 * ritmo); A.lug.agua = Math.max(0, A.lug.agua - dt * 0.004 * ritmo); toma = true; } }   // (EL ALJIBE de un lugar: se gasta; lo llena la lluvia)
  // LLEVAR AGUA: el que sabe, cuando toma llena lo que lleva; lejos del agua y con sed, toma de ahi
  if (toma) A.cantimplora = A.tec.agua; else if (A.sed > 0.7 && A.cantimplora > 0.01) { const k = Math.min(A.cantimplora, dt * 0.08); A.sed -= k; A.cantimplora -= k; if ((A.tAguaL = (A.tAguaL || 0) - dt) <= 0) { A.tAguaL = 30; hizo(M, A, 'tomo del agua que llevaba'); } }
  // EL AVISO: avisa cuando pasa lo que el aviso quiere decir PARA EL (su costumbre 7); lo oyen los de su especie a 60 m, y cada uno lo entiende a su manera
  if ((A.tSenal = (A.tSenal || 0) - dt) <= 0) { const s = A.cult[7]; if (s === 0 ? A.meAtaco > 0.9 || A.tSusto > 0 : s === 1 ? come && A.hambre < 0.3 : A.celo > 0.9) { A.tSenal = 12; if (!gesto) gesto = 'senalA'; hizo(M, A, 'aviso: ' + RASGOS[7].valores[s]); avisar(M, 'senal', A, 0);
      genteCerca(M, A.x, A.z, 60, q => { if (q !== A && q.esp === A.esp && dist(q, A) < 60) (q.oye || (q.oye = [null, null]))[0] = {x: A.x, z: A.z, t: 3, aviso: true}; }); } }
  // SUS MUERTOS: el que tiene por costumbre enterrarlos, al cuerpo de uno de los suyos que tenga al lado lo entierra (vuelve a la tierra: a la energia libre)
  if (A.cult[4] === 1 && A.tHace <= 0 && (A.tMira = (A.tMira || 0) - dt) <= 0) { A.tMira = 2; const c = M.cuerpos.find(q => q.esp === A.esp && q.carne > 0.01 && dist(q, A) < 3); if (c) { c.carne = 0; A.tHace = 5; gesto = 'agarra'; hizo(M, A, 'enterro a uno de los suyos'); (M.tumbas || (M.tumbas = [])).push({x: c.x, z: c.z, t: M.t}); if (M.tumbas.length > 200) M.tumbas.shift(); } }
  // MUDARSE: el que tiene por costumbre irse cuando falta, con mucha hambre deja de recordar su «casa»
  if (A.cult[3] === 1 && A.hambre > 0.8) { A.casa.x = A.x; A.casa.z = A.z; }
  if (gesto) { A.gesto = gesto; A.tGesto = 1.5; } else if (A.tGesto > 0) A.tGesto -= dt;
  A.que = A.atrapado > 0 ? 'atrapado' : A.tSusto > 0 ? 'huye' : A.tGesto > 0 ? A.gesto : A.tEmb > 1 ? 'muerde' : A.caza ? 'caza' : rf ? 'encara' : come && A.v < 0.6 ? 'come' : toma && A.v < 0.6 ? 'toma' : a === 1 && A.v < 0.4 ? 'echado' : A.lleva > 0.05 ? 'lleva' : A.v > 0.7 * E.v ? 'corre' : 'anda';
  if (!cuerpo(M, A, E, dt, a)) return;
  // EL CELO (lo «hormonal»): adulto, comido, tomado y sano, sube solo; si le falta algo, baja. Es un impulso que su red siente
  // (como el hambre); no lo obliga a nada. Lo que hace con el -buscar a quien, elegir a cual- lo decide la red
  A.celo = Math.max(0, Math.min(1, A.celo + (A.edad > 600 && A.hambre < 0.4 && A.sed < 0.5 && A.salud > 0.8 * (A.vigor ?? 1) ? dt : -dt) / E.gesta));
  // IMITAR (el Steve): cada tanto mira a los Steves que tiene cerca; si a alguno le va mejor que a el (mas comido, tomado y
  // sano), le copia un poco de la red (1 de cada 20 pesos). Cuanto imita cada uno es SUYO y se hereda: puede irse a cero.
  if (A.esp === 'steve' && (A.tImita -= dt) <= 0) { A.tImita = 60; if (R() < A.imita) { const bien = q => q.salud - q.hambre - q.sed; let mejor = null, bm = bien(A) + 0.25; genteCerca(M, A.x, A.z, 20, q => { if (q.vivo && q !== A && q.esp === A.esp && dist(q, A) < 20 && bien(q) > bm) { bm = bien(q); mejor = q; } });
      if (mejor) { for (let i = 0; i < A.w.length; i++) if (R() < 0.05) A.w[i] = mejor.w[i]; hizo(M, A, 'imito a otro'); } } }
  cultura(M, A, dt);
}

// UN PASO del mundo entero. (El juego lo parte: pasoBase una vez y despues pasoTribu de a pocas listas por cuadro -las de grupos(M)-, para no dar tirones)
export function paso(M, dt) { pasoBase(M, dt); for (const K of M.tribus) pasoTribu(M, K, dt); pasoTribu(M, M.sueltos, dt); }
export function pasoTribu(M, K, dt) { const l = K.miembros; for (let i = 0, n = l.length; i < n; i++) if (l[i].vivo) vivirGente(M, l[i], dt); }
export function pasoBase(M, dt) {
  M.t += dt; const F = M.R.flora;
  if ((M.tFlora = (M.tFlora || 0) + dt) >= 1) { const E = energia(M); M.libre = E.libre; const e = {fertil: Math.min(1, E.libre / (0.1 * E.total)), aguaDe: (x, z) => aguaDe(M, x, z),   /* (EL CIRCUITO: las matas crecen de la energia libre; con menos de un decimo del total libre, crecen menos; sin nada, no crecen) */ lluvia: (M.llueve ?? (M.t % 3600) < 600) ? F.lluvia : 1, agua: F.agua, ritmo: F.ritmo, hijo: genHijo, nace: m => { m.x = envolver(m.x); m.z = envolver(m.z); }};
    for (const l of M.celdas.values()) M.cuenta.nacenMatas += flora.pasoCelda(l, M.tFlora, e).nacen;
    if (e.lluvia > 1) for (const K of M.tribus) K.agua = Math.min(1, K.agua + M.tFlora / 900);   // (LOS ALJIBES: 15 minutos de lluvia los llenan)
    M.tFlora = 0; }
  M.steves.length = 0; M.porEsp.steve.length = 0; M.porEsp.arana.length = 0; for (const K of M.tribus) for (const s of K.miembros) if (s.vivo) { M.steves.push(s); M.porEsp[s.esp].push(s); } for (const s of M.sueltos.miembros) if (s.vivo) { M.steves.push(s); M.porEsp[s.esp].push(s); }
  armarRejilla(M);
  const G = M.gigante; if (G && !G.ajeno) { if ((G.tGiro -= dt) <= 0) { G.tGiro = 150 + R() * 150; G.rumbo += (R() - 0.5) * 1.5; } mover(G, dt);   /* (ajeno: al gigante lo mueve otro -el juego-; aca solo se lo ve) */
    if ((G.tPaso -= dt) <= 0) { G.tPaso = 1.3; G.lado = -G.lado; const pie = {x: G.x + Math.cos(G.rumbo) * 6 * G.lado, z: G.z - Math.sin(G.rumbo) * 6 * G.lado};
      for (const k of ANIMALES) for (const c of M.pob[k]) if (c.vivo && dist(c, pie) < 3) morir(M, c, 'pisada'); for (const s of M.steves) if (dist(s, pie) < 3) morir(M, s, 'pisada'); } }
  // LAS TELAS: al que la pisa (animal o Steve; las arañas no) lo deja quieto 4 s, y la tela se gasta. Duran 15 minutos
  M.atrapados = M.atrapados || [];
  if (M.telas.length) { for (let i = M.telas.length - 1; i >= 0; i--) { const t = M.telas[i]; if (M.t - t.t > 900) { M.telas.splice(i, 1); continue; } let cayo = null;
      for (const k of ANIMALES) { for (const q of M.pob[k]) if (q.vivo && !(q.atrapado > 0) && dist(q, t) < 2) { cayo = q; break; } if (cayo) break; }
      if (!cayo) genteCerca(M, t.x, t.z, 2, q => { if (!cayo && q.esp !== (t.esp || 'arana') && q.vivo && !(q.atrapado > 0) && dist(q, t) < 2) cayo = q; });   /* (la tela no atrapa arañas; la trampa de un Steve no atrapa Steves) */
      if (cayo) { cayo.atrapado = 4 * (1 + 2 * (t.z0 || 0)); M.atrapados.push(cayo); M.telas.splice(i, 1); const k = (t.esp || 'arana') + (t.esp === 'steve' ? ': una trampa atrapo algo' : ': una tela atrapo algo'); M.cuenta.hizo[k] = (M.cuenta.hizo[k] || 0) + 1; } }
    M.atrapados = M.atrapados.filter(q => q.vivo && q.atrapado > 0); }
  for (const l of M.celdas.values()) for (const p of l) { p.bocasAnt = p.bocas || 0; p.bocas = 0; }
  for (const k of ANIMALES) { const l = M.pob[k]; for (let i = 0, n = l.length; i < n; i++) if (l[i].vivo) vivir(M, l[i], dt); }
  for (const c of M.cuerpos) c.carne = Math.max(0, c.carne - dt / ((c.sombra ? 4 * M.R.pudre : M.R.pudre) * (1 + 4 * (c.conserva || 0))));   // (se pudre; a la sombra de un lugar, 4 veces mas despacio)
  // limpiar los muertos, y LO UNICO que no sale solo: si una especie se extingue, a los 10 minutos LLEGAN de afuera unos pocos,
  // con las redes de los ultimos que tuvieron cria (o la semilla). Se cuenta, para no esconderlo. (Los lugares ya NO se repueblan
  // solos: un lugar vacio queda vacio hasta que alguien vuelva a el.)
  if ((M.tLimpia = (M.tLimpia || 0) + dt) >= 5) { M.tLimpia = 0; M.cuerpos = M.cuerpos.filter(c => c.carne > 0); M.tSin = M.tSin || {};
    while (M.rastros.length && M.t - M.rastros[0].t > 300) M.rastros.shift();
    for (const k of ANIMALES) { M.pob[k] = M.pob[k].filter(c => c.vivo); if (M.pob[k].length || !M.semillas?.[k] || !M.quiere[k] || M.sinLlegadas) { M.tSin[k] = 0; continue; }
      if ((M.tSin[k] = (M.tSin[k] || 0) + 5) >= 600) { M.tSin[k] = 0; M.cuenta.llegadas[k] = (M.cuenta.llegadas[k] || 0) + 1; const oa = M.oasis[Math.floor(R() * M.oasis.length)], b = M.banco[k];
        for (let i = 0; i < 4 && M.oasis.length; i++) { const q = b.length ? b[Math.floor(R() * b.length)] : {w: M.semillas[k], tam: M.R.esp[k].tam}; nacer(M, k, oa.x + (R() - 0.5) * 60, oa.z + (R() - 0.5) * 60, pesosHijos(q.w), q.tam, null); } } }
    acomodar(M);
    if (M.semillaG) for (const k of TRIBALES) { if (M.porEspN[k] || !M.quiereG[k] || M.sinLlegadas) { M.tSin[k] = 0; continue; }
      if ((M.tSin[k] = (M.tSin[k] || 0) + 5) >= 600) { M.tSin[k] = 0; M.cuenta.llegadas[k] = (M.cuenta.llegadas[k] || 0) + 1; llegaGente(M, k); } } }
}
// QUIEN ESTA ANOTADO DONDE (cada 5 s): cada uno queda en la lista del lugar que tiene a menos de 25 m de su «casa», o en la de los
// sueltos. Y lo que se ve de cada lugar sale de ahi: cuantos son, de que especie la mayoria, de que color, cuanta comida hay tirada
function acomodar(M) {
  const todos = []; for (const K of grupos(M)) { for (const s of K.miembros) if (s.vivo) todos.push(s); K.miembros.length = 0; }
  M.porEspN = {steve: 0, arana: 0};
  for (const s of todos) { const K = lugarDe(M, s.casa.x, s.casa.z, 25) || M.sueltos; s.K = K; K.miembros.push(s); M.porEspN[s.esp]++; }
  for (const K of M.tribus) { let s = 0; for (const c of M.cuerpos) if (c.carne > 0 && Math.hypot(env(c.x - K.x), env(c.z - K.z)) < 8) s += c.carne; K.comida = Math.min(1, s / 3);
    const l = K.miembros; if (!l.length) continue; let ar = 0, sS = 0, sC = 0, g = 0; for (const q of l) { if (q.esp === 'arana') ar++; sS += Math.sin(q.remera * TAU); sC += Math.cos(q.remera * TAU); g = Math.max(g, q.gen); }
    K.esp = ar * 2 > l.length ? 'arana' : 'steve'; K.marca = vuelta(Math.atan2(sS, sC) / TAU); K.gen = g; }
}

// ---------- EL CIRCUITO DE LA ENERGIA ----------
// donde esta la energia del mundo ahora. libre = el total menos todo lo demas (nunca menos de 0: si falta, «deuda» dice cuanto)
export function energia(M) {
  let matas = 0, reservas = 0, cuerpos = 0, llevan = 0, tirada = 0;
  for (const l of M.celdas.values()) for (const p of l) matas += flora.energiaDe(p);
  const uno = a => { if (!a.vivo) return; reservas += (1 - Math.min(1, a.hambre)) * barriga(M, a); cuerpos += a.cuerpo || 0; llevan += a.lleva || 0; };
  for (const k of ANIMALES) for (const a of M.pob[k]) uno(a); for (const K of grupos(M)) for (const a of K.miembros) uno(a);
  for (const c of M.cuerpos) tirada += c.carne;
  const usada = matas + reservas + cuerpos + llevan + tirada; if (!(M.energiaTotal > 0)) M.energiaTotal = M.R.flora.energia > 0 ? M.R.flora.energia * (L / CELDA) ** 2 : usada * 1.25;
  return {total: M.energiaTotal, libre: Math.max(0, M.energiaTotal - usada), deuda: Math.max(0, usada - M.energiaTotal), matas, reservas, cuerpos, llevan, tirada};
}

// ---------- MIRAR ----------
export function censo(M) {
  const med = (l, f) => l.length ? +(l.reduce((a, e) => a + f(e), 0) / l.length).toFixed(2) : 0, c = {minuto: Math.round(M.t / 60), matas: flora.resumen(M.celdas.values()), esp: {}, ...M.cuenta};
  for (const k of ANIMALES) { const l = M.pob[k].filter(a => a.vivo); c.esp[k] = {n: l.length, tam: med(l, a => a.tam), gen: l.reduce((a, e) => Math.max(a, e.gen), 0), genMedia: med(l, a => a.gen), hambre: med(l, a => a.hambre), llegadas: M.cuenta.llegadas[k] || 0}; }
  for (const k of TRIBALES) { const l = []; for (const K of grupos(M)) for (const s of K.miembros) if (s.vivo && s.esp === k) l.push(s); c.esp[k] = {n: l.length, tam: med(l, a => a.tam), gen: l.reduce((a, e) => Math.max(a, e.gen), 0), genMedia: med(l, a => a.gen), hambre: med(l, a => a.hambre), imita: med(l, a => a.imita), celo: med(l, a => a.celo), vigor: med(l, a => a.vigor ?? 1), llegadas: M.cuenta.llegadas[k] || 0}; }
  c.tribus = M.tribus.map(K => ({esp: K.esp, n: K.miembros.filter(q => q.vivo).length, comida: +K.comida.toFixed(2), agua: +K.agua.toFixed(2), gen: K.gen}));
  c.cultura = {}; for (const k of TRIBALES) { const l = []; for (const K of grupos(M)) for (const s of K.miembros) if (s.vivo && s.esp === k) l.push(s); c.cultura[k] = culturaDeEspecie(l); }
  c.lugares = {hay: M.tribus.length, habitados: c.tribus.filter(t => t.n > 0).length, sueltos: M.sueltos.miembros.filter(q => q.vivo).length};
  return c;
}
// LA FOTO: todo lo que hace falta para seguir desde aca (desdeFoto), o para arrancar el juego desde este momento
export function foto(M) {
  const r4 = w => Array.from(w, v => Math.round(v * 1e4) / 1e4), n3 = v => Math.round(v * 1e3) / 1e3, cuerpoDe = c => ({hambre: n3(c.hambre), sed: n3(c.sed), cansancio: n3(c.cansancio), salud: n3(c.salud)});
  const f = {version: 6, t: M.t, L, X0, energiaTotal: M.energiaTotal, receta: diferencia(M.R), censo: censo(M), oasis: M.oasis, gigante: M.gigante, cuenta: M.cuenta, quiere: M.quiere, quiereG: M.quiereG, animales: {},
    pilas: M.cuerpos.filter(c => c.carne > 0.05).map(c => ({x: n3(c.x), z: n3(c.z), carne: n3(c.carne), de: c.de || 0})),
    matas: [...M.celdas.values()].flat().map(p => ({x: n3(p.x), z: n3(p.z), comida: n3(p.comida), tam: n3(p.tam ?? 1), res: n3(p.res || 0), semE: n3(p.semE || 0), gen: p.gen || 0, hija: !!p.hija, g: {...p.g, w: r4(p.g.w || [])}}))};
  for (const k of ANIMALES) f.animales[k] = M.pob[k].filter(c => c.vivo).map(c => ({x: n3(c.x), z: n3(c.z), rumbo: n3(c.rumbo), tam: n3(c.tam), edad: Math.round(c.edad), gen: c.gen, cria: n3(c.cria), hijos: c.hijos, presas: c.presas, remera: n3(c.remera), cuerpo: n3(c.cuerpo || 0), ...cuerpoDe(c), w: r4(c.w)}));
  f.tribus = grupos(M).map(K => ({suelto: K.suelto || undefined, esp: K.esp, x: n3(K.x || 0), z: n3(K.z || 0), estetica: K.estetica, agresiva: K.agresiva, gen: K.gen, plId: K.plId, cultura: K.cultura || null, marca: n3(K.marca || 0), agua: n3(K.agua),
    miembros: K.miembros.filter(q => q.vivo).map(q => ({esp: q.esp, x: n3(q.x), z: n3(q.z), gen: q.gen, edad: Math.round(q.edad), hijoDeDos: !!q.padres, ...cuerpoDe(q), lleva: n3(q.lleva), imita: n3(q.imita), marca: n3(q.marca), remera: n3(q.remera), casa: {x: n3(q.casa.x), z: n3(q.casa.z)}, celo: n3(q.celo), vigor: n3(q.vigor ?? 1), cuerpo: n3(q.cuerpo || 0), cult: Array.from(q.cult), tec: Object.fromEntries(CLAVES_TEC.map(k => [k, n3(q.tec[k])])), cantimplora: n3(q.cantimplora || 0), tam: n3(q.tam), w: r4(q.w), ficha: q.ficha || undefined}))}));
  return f;
}
// volver a armar un mundo desde una foto. o: {semillas} (para los que lleguen de afuera); o.receta: lo que se quiera cambiar encima.
// Las fotos de antes (version 5 o menos: campamentos con dueño, coyotes del tamaño de un cerdo) se pasan a la forma de ahora
export function desdeFoto(f, o = {}) {
  const M = mundoVacio({...o, receta: mezclar(mezclar(recetaBase(), f.receta), o.receta)}), vieja = !(f.version >= 6); M.t = f.t || 0; M.energiaTotal = f.energiaTotal || 0; M.oasis = f.oasis.map(q => ({...q})); M.gigante = f.gigante ? {...f.gigante} : null;
  M.quiere = f.quiere ? {...f.quiere} : {cerdo: true, coyote: true}; M.quiereG = f.quiereG ? {...f.quiereG} : {steve: (f.tribus || []).some(t => t.esp === 'steve'), arana: (f.tribus || []).some(t => t.esp === 'arana')};
  if (f.cuenta) M.cuenta = {nacen: {...f.cuenta.nacen}, nacenMatas: f.cuenta.nacenMatas || 0, muertes: {...f.cuenta.muertes}, llegadas: {...f.cuenta.llegadas}, hizo: {...f.cuenta.hizo}};
  for (const p of f.matas) celdaDe(M, p.x, p.z).push({x: envolver(p.x), z: envolver(p.z), comida: p.comida, tam: p.tam, res: p.res, semE: p.semE || 0, gen: p.gen, hija: p.hija, R: 3, sem: R() * 100, g: {...p.g, w: Float32Array.from(p.g.w)}});
  for (const k of ANIMALES) for (const c of f.animales?.[k] || []) nacer(M, k, c.x, c.z, Float32Array.from(c.w), vieja ? c.tam * M.R.esp[k].tam : c.tam, null, {rumbo: c.rumbo, edad: c.edad, gen: c.gen, cria: c.cria || 0, hijos: c.hijos || 0, presas: c.presas || 0, remera: c.remera ?? R(), ...(c.cuerpo !== undefined ? {cuerpo: c.cuerpo} : null), hambre: c.hambre, sed: c.sed, cansancio: c.cansancio, salud: c.salud});
  if (M.semillaG) for (const t of f.tribus || []) { const K = t.suelto ? M.sueltos : campo(M, t);
    for (const q of t.miembros) { const s = nuevaGente(M, K, {...q, esp: q.esp || t.esp, remera: q.remera ?? q.marca, w: q.w || q.ficha?.wF, padres: null}); if (q.hijoDeDos) s.padres = [0, 0]; } }
  for (const c of f.pilas || []) dejar(M, c.x, c.z, c.carne, c.de);
  acomodar(M);
  return M;
}
