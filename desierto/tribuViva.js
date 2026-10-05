// LA RED DE DECIDIR y EL CUERPO PROPIO de cada Steve y cada araña (05-10, ?vivo).
// EL CUERPO: cada uno lleva SU hambre, SU sed, SU cansancio y SU salud (como los cerdos y los coyotes). El hambre baja solo
// si EL come de la despensa de la tribu (en el fogon); la sed, si EL va a tomar (al aljibe del campamento o a un oasis); el
// cansancio, si EL duerme. Con hambre o sed al maximo pierde salud, y se muere EL: no uno al azar.
// LA RED (18 -> 12 -> 15, 423 pesos) siente eso y lo de la tribu, y decide tres cosas:
//   - LO SUYO: seguir con lo que hace la tribu, ir a comer, ir a tomar o dormir
//   - EL LUGAR al que lleva a su grupo: fogon, portico, contorno, techo, la tribu vecina
//   - SU VOTO en el consejo: cazar, guerra, festejo, adorar, juntar, descansar
// SEMILLA POR IMITACION: la primera generacion sale de una red entrenada para decidir igual que las tablas escritas a mano
// de antes (tools/vivo/semilla-tribu.mjs -> public/tribu-decide.json), cada uno con una variacion chica. De ahi en mas se
// HEREDA: el hijo lleva mezclados los pesos de sus dos padres, con mutacion. Nadie pone puntaje: son padres los que estan
// comidos, tomados y sanos, y siguen los que no se mueren.
// Sin THREE ni DOM: lo usan el juego, el mundo sin graficos y el entrenador de la semilla.
export const N_ENT = 18, N_OC = 12, LUGARES = ['fogon', 'portico', 'contorno', 'techo', 'vecino'], DECISIONES = ['cazar', 'guerra', 'festejo', 'adorar', 'juntar', 'descansar'], PERSONAL = ['seguir', 'comer', 'tomar', 'dormir'];
export const N_SAL = LUGARES.length + DECISIONES.length + PERSONAL.length, N_PESOS = N_ENT * N_OC + N_OC + N_OC * N_SAL + N_SAL, I_DEC = LUGARES.length, I_PER = LUGARES.length + DECISIONES.length;
const _h = new Float32Array(N_OC), _s = new Float32Array(N_SAL);
// la red: devuelve en `sal` las 15 ganas (en logaritmo: peso() las vuelve positivas)
export function ganas(w, x, sal = _s) {
  for (let j = 0; j < N_OC; j++) { let a = w[N_ENT * N_OC + j]; for (let i = 0; i < N_ENT; i++) a += w[j * N_ENT + i] * x[i]; _h[j] = Math.tanh(a); }
  const b = N_ENT * N_OC + N_OC; for (let k = 0; k < N_SAL; k++) { let a = w[b + N_OC * N_SAL + k]; for (let j = 0; j < N_OC; j++) a += w[b + k * N_OC + j] * _h[j]; sal[k] = a; }
  return sal;
}
export const peso = v => Math.exp(Math.max(-5, Math.min(3, v)));
// LO QUE SIENTE. c: lo de la tribu {noche, comida, agresiva, rencorVec, otraEspecie, cercaGigante, pisadas, rencorGig, vivos,
// estetica, distinto}; q: SU cuerpo {hambre, sed, cansancio, salud} (se puede cambiar solo eso con sentirCuerpo)
export function contexto(c, x, q) {
  x[0] = c.noche; x[1] = c.comida; x[2] = c.agresiva ? 1 : 0; x[3] = Math.min(1, c.rencorVec / 4); x[4] = c.otraEspecie ? 1 : 0; x[5] = c.cercaGigante ? 1 : 0; x[6] = Math.min(1, c.pisadas / 3);
  x[7] = Math.min(1, c.rencorGig / 5); x[8] = Math.min(1, c.vivos / 14); x[9] = c.estetica === 'hippie' ? 1 : 0; x[10] = c.estetica === 'punk' ? 1 : 0; x[11] = c.estetica === 'cyber' ? 1 : 0; x[12] = c.distinto; x[17] = 1;
  return sentirCuerpo(x, q);
}
export function sentirCuerpo(x, q) { x[13] = q?.hambre ?? 0.3; x[14] = q?.sed ?? 0.3; x[15] = q?.cansancio ?? 0.2; x[16] = q?.salud ?? 1; return x; }
// LO SUYO: que quiere hacer ahora (la opcion con mas ganas)
export function loSuyo(w, x) { ganas(w, x, _s); let m = 0; for (let k = 1; k < PERSONAL.length; k++) if (_s[I_PER + k] > _s[I_PER + m]) m = k; return PERSONAL[m]; }

// ---------- EL CUERPO ----------
export const CUERPO = {steve: {tHambre: 1500, tSed: 1200}, arana: {tHambre: 1200, tSed: 1000}}, RACIONES = 8;   // (una despensa llena: 8 comidas completas)
export function cuerpoNuevo(q, chico) { q.hambre = chico ? 0.4 : 0.15 + Math.random() * 0.3; q.sed = chico ? 0.35 : 0.15 + Math.random() * 0.3; q.cansancio = 0.2; q.salud = 1; return q; }
// un paso del cuerpo. `esfuerzo`: 0 quieto ... 1 corriendo a fondo. Devuelve false si se murio (q.muerteDe dice de que)
export function cuerpo(q, esp, dt, esfuerzo = 0, propio = null) {   // (propio: {tHambre, tSed} de la receta del mundo, si la hay)
  const E = propio || CUERPO[esp] || CUERPO.steve;
  q.hambre = Math.min(1, q.hambre + dt / E.tHambre); q.sed = Math.min(1, q.sed + dt / E.tSed); q.cansancio = Math.min(1, Math.max(0, q.cansancio + dt * (0.0004 + 0.004 * esfuerzo * esfuerzo)));
  if (q.hambre >= 1 || q.sed >= 1) q.salud -= dt / 200; if (q.cansancio >= 1) q.salud -= dt / 400;
  if (q.salud <= 0) { q.muerteDe = q.hambre >= 1 ? 'hambre' : q.sed >= 1 ? 'sed' : 'agotamiento'; return false; }
  return true;
}
// come de la despensa: devuelve cuanto le saca a la despensa (0..1)
export function comer(q, dt, despensa) { const k = Math.min(q.hambre, dt * 0.03, despensa * RACIONES); q.hambre -= k; return k / RACIONES; }
export function tomar(q, dt) { q.sed = Math.max(0, q.sed - dt * 0.08); }
export function dormir(q, dt) { q.cansancio = Math.max(0, q.cansancio - dt * 0.012); if (q.hambre < 0.6 && q.sed < 0.6) q.salud = Math.min(1, q.salud + dt / 300); }
export const sano = q => q.hambre < 0.5 && q.sed < 0.5 && q.salud > 0.8;   // (el que puede ser padre)

// ---------- LA HERENCIA ----------
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(6.2832 * Math.random());
export const variar = (w, sigma = 0.05) => Array.from(w, v => v + gauss() * sigma);   // (el que llega de afuera: la semilla, con su variacion)
// EL HIJO: cada peso, de uno de los dos padres al azar; uno de cada diez, ademas, corrido un poco
export function hijo(a, b) { const h = new Array(a.length); for (let i = 0; i < h.length; i++) { h[i] = Math.random() < 0.5 ? a[i] : b[i]; if (Math.random() < 0.1) h[i] += gauss() * 0.08; } return h; }
