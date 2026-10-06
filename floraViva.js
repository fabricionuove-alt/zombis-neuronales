// LA FLORA VIVA (04-10, ?vivo). Cada mata tiene SU red y SU tamaño, y nadie le pone techo: el techo sale del agua.
// El diseño es el estandar de la vida artificial (herencia al nacer con mutacion, sin puntaje; cada rasgo cuesta energia):
// The Bibites, JaxLife (Lu et al. 2024), Primordia (github.com/ardakalper/primordia, MIT: "every trait has an energy price").
//  - ENERGIA: gana segun el agua del lugar, sus hojas y su tamaño^0.6 (lo grande se hace sombra a si mismo); gasta segun su
//    tamaño (mantenerse). De ahi sale solo el tamaño que cada lugar aguanta: tam* = (gana/gasta)^2.5. Con agua estable crece
//    y crece; en la sequia las grandes son las primeras en achicarse.
//  - EL AGUA DE LA CELDA SE REPARTE, y cuando no alcanza le toca mas a la grande (raices mas hondas, sombra sobre la chica:
//    la competencia entre plantas es asimetrica, Weiner 1990). Una semilla casi no prende donde ya no sobra agua. No hay
//    tope de cantidad ni de tamaño: hay agua o no hay.
//  - LA RED (8 -> 5 -> 4, 64 pesos, heredada con mutacion) decide en que gasta lo que le sobra: CRECER, HOJAS (lo que se
//    come), SEMILLAS o RESERVA (para aguantar la seca). Nadie le dice que es lo bueno: la que deja mas hijas, queda.
// Sin THREE ni DOM: el mismo archivo sirve para el juego y para la simulacion sin graficos.
export const N_ENT = 8, N_OC = 5, N_SAL = 4, N_PESOS = N_ENT * N_OC + (N_OC + 1) * N_SAL;
const EXP = 0.6, MANT = 1 / 220, GANA = 2.2 * MANT, TAM_SEMILLA = 0.2, TAM_MUERE = 0.12, AGUA_CELDA = 30, COSTO_SEMILLA = 0.3;
// EL AZAR, CON SEMILLA (11-10): todo lo que se sortea en el mundo (aca y en mundoVivo.js) sale de azar(). sembrar(n) lo vuelve
// repetible -la misma semilla, el mismo mundo, numero por numero-: sin eso una corrida no se puede volver a hacer ni comparar
// con otra. sembrar() sin nada vuelve al azar comun.
let _azar = Math.random;
export const azar = () => _azar();
export function sembrar(n) { if (n == null) { _azar = Math.random; return; } let a = n >>> 0; _azar = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }   // (mulberry32)
const gauss = () => { let u = 0, v = 0; while (!u) u = azar(); while (!v) v = azar(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); };

// los pesos de la primera generacion: ruido chico + un reparto de nacimiento razonable (crecer y hojas; algo de semilla).
// Sin ese reflejo las primeras se mueren antes de que la seleccion encuentre nada (lo mismo que hace Primordia)
export function pesosNuevos(r = azar) {
  const w = new Float32Array(N_PESOS); for (let i = 0; i < N_PESOS; i++) w[i] = (r() - 0.5) * 0.3;
  const sesgo = N_ENT * N_OC + N_OC * N_SAL; w[sesgo] = 0.6; w[sesgo + 1] = 0.6; w[sesgo + 2] = 0; w[sesgo + 3] = -0.6;
  return w;
}
export function pesosHijos(w) { const h = Float32Array.from(w); for (let i = 0; i < h.length; i++) if (azar() < 0.2) h[i] = Math.max(-6, Math.min(6, h[i] + gauss() * 0.15)); return h; }

const _h = new Float32Array(N_OC), _s = new Float32Array(N_SAL);
// la red: devuelve en `sal` el reparto (suma 1) entre crecer, hojas, semillas y reserva
export function repartir(w, x, sal = _s) {
  for (let h = 0; h < N_OC; h++) { let a = 0; for (let i = 0; i < N_ENT; i++) a += x[i] * w[i * N_OC + h]; _h[h] = Math.tanh(a); }
  const b = N_ENT * N_OC; let m = -1e9;
  for (let o = 0; o < N_SAL; o++) { let a = w[b + N_OC * N_SAL + o]; for (let h = 0; h < N_OC; h++) a += _h[h] * w[b + h * N_SAL + o]; sal[o] = a; if (a > m) m = a; }
  let t = 0; for (let o = 0; o < N_SAL; o++) { sal[o] = Math.exp(sal[o] - m); t += sal[o]; } for (let o = 0; o < N_SAL; o++) sal[o] /= t;
  return sal;
}
// lo que le cuesta cada rasgo heredado (los mismos genes de siempre: crece, sequia, fibra, espina)
const precio = g => 1 + 0.35 * g.espina + 0.3 * g.fibra + 0.25 * g.sequia + 0.4 * (g.crece - 1);
export const aguaEfectiva = (agua, g) => agua + g.sequia * 0.45 * (1 - agua);

const _x = new Float32Array(N_ENT);
// UN PASO de una celda de matas. `lista`: las matas ({x, z, comida, g, tam, res, sem...}); env: {aguaDe(x,z), lluvia (1 o mas),
// hijo(g) -> genes del hijo, nace(mata) opcional}. Devuelve cuantas nacieron y murieron
export function pasoCelda(lista, dt, env) {
  let pide = 0, aguaMedia = 0, tamTotal = 0;
  for (const p of lista) {
    if (p.tam === undefined) { p.tam = p.hija ? TAM_SEMILLA : 1; p.res = 0; p.semE = 0; p.comida = Math.min(p.comida, p.tam); }
    if (!p.g.w) p.g.w = pesosNuevos();
    if (p.ag === undefined) p.ag = aguaEfectiva(env.aguaDe(p.x, p.z), p.g);
    pide += Math.pow(p.tam, EXP) * p.g.crece; aguaMedia += p.ag; tamTotal += p.tam;
  }
  if (!lista.length) return {nacen: 0, mueren: 0};
  // (env.agua y env.ritmo: perillas de la receta del mundo -cuanta agua hay por celda, que tan rapido crece todo-; sin ellas, lo de siempre)
  const hay = (env.agua ?? AGUA_CELDA) * (aguaMedia / lista.length) * env.lluvia, alcanza = Math.min(1, hay / pide);
  let nacen = 0, mueren = 0;
  for (let k = lista.length - 1; k >= 0; k--) {
    const p = lista[k], g = p.g, hojas = p.comida / p.tam, toca = alcanza >= 1 ? 1 : Math.min(1, hay * (p.tam / tamTotal) / (Math.pow(p.tam, EXP) * g.crece));   /* (lo que le toca de lo que pide) */
    const gana = GANA * (env.ritmo ?? 1) * (env.fertil ?? 1) * p.ag * env.lluvia * g.crece * Math.pow(p.tam, EXP) * toca * (0.35 + 0.65 * hojas),   /* (env.fertil: cuanta energia libre queda en el mundo -ver EL CIRCUITO en mundoVivo.js-; sin energia libre, nada crece) */
      gasta = MANT * p.tam * precio(g);
    // cuanto la estan comiendo (lo que bajo desde el paso anterior, que no fue ella)
    const mordida = p.c0 === undefined ? 0 : Math.max(0, p.c0 - p.comida) / Math.max(dt, 1e-3); p.dano = (p.dano || 0) * 0.9 + mordida * 0.1;
    let e = (gana - gasta) * dt;
    if (e > 0) {
      _x[0] = Math.max(-1, Math.min(2, gana / gasta - 1)); _x[1] = Math.log2(p.tam) / 3; _x[2] = hojas; _x[3] = Math.min(1, p.dano * 60);
      _x[4] = toca; _x[5] = env.lluvia > 1 ? 1 : 0; _x[6] = p.res / p.tam; _x[7] = 1;
      const r = repartir(g.w, _x);
      p.tam += e * r[0]; p.comida = Math.min(p.tam, p.comida + e * r[1] * 2); p.semE += e * r[2]; p.res = Math.min(p.tam, p.res + e * r[3]);
    } else {   // no le alcanza: primero la reserva, despues se achica
      const deR = Math.min(p.res, -e); p.res -= deR; e += deR; p.tam += e; p.comida = Math.min(p.comida, Math.max(0, p.tam));
    }
    // EL REBROTE: pelada, saca de la reserva para volver a echar hoja (para eso la junto)
    if (p.res > 0 && p.comida < 0.3 * p.tam) { const k = Math.min(p.res, dt * 0.01 * p.tam); p.res -= k; p.comida += k; }
    if (p.tam < TAM_MUERE) {
      if (lista.length > 1) { lista.splice(k, 1); mueren++; continue; }
      p.tam = TAM_MUERE; p.comida = Math.min(p.comida, p.tam);   // (la ultima de la celda queda como banco de semillas)
    }
    p.c0 = p.comida;
    if (p.semE >= COSTO_SEMILLA) {
      p.semE -= COSTO_SEMILLA; const a = azar() * 6.2832, d = 3 + (g.dispersa * 14 + azar() * 4) * Math.sqrt(p.tam), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      const gh = env.hijo(g); gh.w = pesosHijos(g.w); const ag = aguaEfectiva(env.aguaDe(x, z), gh);
      // prende segun el agua de donde cae, y no encima de otra
      if (azar() < ag * ag * alcanza * alcanza * alcanza && !lista.some(q => Math.hypot(q.x - x, q.z - z) < 1.5 + Math.sqrt(q.tam || 1))) {
        const m = {x, z, comida: TAM_SEMILLA * 0.5, R: 3, sem: azar() * 100, hija: true, g: gh, tam: TAM_SEMILLA, res: 0, semE: 0, ag, gen: (p.gen || 0) + 1};
        lista.push(m); nacen++; env.nace?.(m);
      }
    }
  }
  return {nacen, mueren};
}
// LA ENERGIA que hay guardada en una mata: su cuerpo, sus hojas, su reserva y lo que junto para semillas
export const energiaDe = p => (p.tam ?? 1) + p.comida + (p.res || 0) + (p.semE || 0);
export function resumen(listas) {
  let n = 0, tam = 0, max = 0, gen = 0, esp = 0, cre = 0, seq = 0; const rep = [0, 0, 0, 0];
  for (const l of listas) for (const p of l) { if (p.tam === undefined || !p.g.w) continue; n++; tam += p.tam; if (p.tam > max) max = p.tam; gen = Math.max(gen, p.gen || 0); esp += p.g.espina; cre += p.g.crece; seq += p.g.sequia;
    _x.fill(0); _x[2] = 1; _x[4] = 1; _x[7] = 1; const r = repartir(p.g.w, _x); for (let o = 0; o < 4; o++) rep[o] += r[o]; }
  const d = n || 1; return {matas: n, tamMedio: +(tam / d).toFixed(2), tamMax: +max.toFixed(2), generacion: gen, espina: +(esp / d).toFixed(2), crece: +(cre / d).toFixed(2), sequia: +(seq / d).toFixed(2),
    reparto: {crecer: +(rep[0] / d).toFixed(2), hojas: +(rep[1] / d).toFixed(2), semillas: +(rep[2] / d).toFixed(2), reserva: +(rep[3] / d).toFixed(2)}};
}
