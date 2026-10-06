// EL MAESTRO (12-10): un cerebro escrito a mano, lo mas simple que sabe vivir en este mundo. Decide SOLO con lo que la red
// siente (el mismo vector de sentidos), para que la red lo pueda imitar. No es para el juego: sirve para dos cosas:
//   1. MEDIR: si con el maestro manejando las especies persisten, el mundo esta bien y lo que fallaba eran los cerebros.
//   2. ENSEÑAR: la red de cada especie aprende a imitarlo y esa es su semilla (como el cerebro basico con el que arrancan los
//      Bibites, o la semilla de los zombis de PZ que imita al vanilla). De ahi en mas, la evolucion.
// Las reglas son las del modelo de referencia (lobos-ovejas-pasto de NetLogo, Wilensky 1997), puestas en un cuerpo:
//   peligro encima -> se aleja · cansado -> se echa · con sed -> al agua · con hambre -> a la comida (el que caza, corre y muerde
//   lo que tiene a tiro) · en celo -> busca a los suyos y elige aparearse · si no, anda despacio cerca de los suyos
const SECT = 8, TAU = 6.2832;
const mejor = (x, base) => { let f = 0, s = -1; for (let k = 0; k < SECT; k++) if (x[base + k] > f) { f = x[base + k]; s = k; } return [f, s < 0 ? 0 : (s + 0.5) / SECT * TAU - Math.PI]; };
const hacia = a => Math.max(-1, Math.min(1, a * 1.5)), lejos = a => Math.max(-1, Math.min(1, (a > 0 ? a - Math.PI : a + Math.PI) * 1.5));
export function maestro(A, x) {
  const hambre = x[0], sed = x[1], cans = x[2], enAgua = x[4] > 0.5, sobreComida = x[5] > 0.5, v = x[8], gente = x.length > 57, caza = A.esp === 'coyote' || A.esp === 'arana';
  const [fC, aC] = mejor(x, 9), [fA, aA] = mejor(x, 17), [fP, aP] = mejor(x, 25), [fS, aS] = mejor(x, 49);
  const celo = gente ? x[57 + 16] : 0, pareja = gente && x[57 + 19] > 0.5, acc = celo > 0.95 ? 10 : 0;   // (el que esta en celo lo muestra mientras hace lo demas)
  if (fP > 0.7) return {giro: lejos(aP), vel: 1, accion: 0};                                              // peligro encima
  if (cans > 0.6 || (cans > 0.3 && v < 0.1 && hambre < 0.7 && sed < 0.7)) return {giro: 0, vel: 0, accion: 1};   // cansado: se echa (y sigue echado hasta reponerse)
  const quiereAgua = sed > 0.45 || (enAgua && sed > 0.08), quiereComer = hambre > 0.35 || (sobreComida && hambre > 0.08);
  if (quiereAgua && (sed >= hambre || !quiereComer)) { if (enAgua) return {giro: 0, vel: 0, accion: acc}; if (fA > 0) return {giro: hacia(aA), vel: 0.6, accion: acc}; }
  if (quiereComer) { if (sobreComida) return {giro: 0, vel: 0, accion: acc};
    if (fC > 0) return caza ? {giro: hacia(aC), vel: fC > 0.6 ? 1 : 0.6, accion: fC > 0.95 ? 3 : acc} : {giro: hacia(aC), vel: 0.6, accion: acc}; }
  if (quiereAgua) { if (enAgua) return {giro: 0, vel: 0, accion: acc}; if (fA > 0) return {giro: hacia(aA), vel: 0.6, accion: acc}; }
  if (pareja) return {giro: 0, vel: 0.05, accion: acc};
  if (fS > 0 && (celo > 0.7 || fS < 0.6)) return {giro: hacia(aS), vel: 0.3, accion: acc};                 // con los suyos (sin encimarse)
  return {giro: 0.15, vel: 0.3, accion: acc};                                                              // anda despacio, en ronda
}
