// ESPECIMENES DE LA TUTORA: reglas escritas a mano. Cada una recibe el episodio, el zombi y lo que haria el vanilla, y
// devuelve {giro, vel, accion, gem}. tutor.mjs las prueba contra el vanilla y, si sirven, las pasa a una red residual
// que se inyecta en el torneo. Cada regla dice de donde salio la idea.
import {util, seVe} from '../mundo.js';
const {dist, ang} = util;
const girarA = (z, th) => Math.max(-1, Math.min(1, ang(th - z.a) * 2));
const mira = (h, z) => (Math.cos(h.a) * (z.x - h.x) + Math.sin(h.a) * (z.y - h.y)) / (dist(h, z) || 1);   // (1 = la presa me mira, -1 = me da la espalda)
const pegados = (ep, h, z, r) => ep.zombis.filter(o => o !== z && o.vivo && !(o.piso > 0) && dist(o, h) < r).length;

export const REGLAS = [
  {nombre: 'espalda-y-monton', fuente: 'intuicion de la tutora, sobre el codigo de BodyDamage: la mordida sube de 15% a 40% desde atras y +30 puntos por cada zombi extra; el golpe del jugador corta el mordisco',
   politica(ep, z, v) {
     if (z.ve < 0) return v;   // (sin presa a la vista: hace lo de siempre)
     const h = ep.humanos[z.ve], d = dist(h, z), a = Math.atan2(h.y - z.y, h.x - z.x), f = mira(h, z), otros = pegados(ep, h, z, 1.5);
     const gem = d < 12;   // (gime al verla: llama a los demas)
     if (d < 2.4 && f > 0.3 && otros === 0) {   // (me mira y estoy solo: no entro al golpe, la rodeo para buscarle la espalda)
       const lado = Math.sign((Math.cos(h.a) * (z.y - h.y) - Math.sin(h.a) * (z.x - h.x))) || 1, th = a + lado * (d < 1.6 ? 2.0 : 1.4);
       return {giro: girarA(z, th), vel: 0.8, accion: 0, gem}; }
     return {giro: girarA(z, a), vel: 1, accion: 1, gem};   // (me da la espalda o ya hay otro pegado: a morder)
   }},
  {nombre: 'manada-muro2011', fuente: 'Muro et al. 2011, Behavioural Processes: los lobos rodean a la presa con dos reglas (acercarse hasta una distancia segura y alejarse de los otros lobos)',
   politica(ep, z, v) {
     if (z.ve < 0) return v;
     const h = ep.humanos[z.ve], d = dist(h, z), a = Math.atan2(h.y - z.y, h.x - z.x), f = mira(h, z), cerco = pegados(ep, h, z, 2.6);
     if (d > 2.6 || cerco >= 2 || f < -0.2) return {giro: girarA(z, a), vel: 1, accion: d < 2.6 ? 1 : v.accion, gem: false};   // (lejos: acercarse; cerco hecho o de espaldas: todos a la vez)
     let rx = 0, ry = 0; for (const o of ep.zombis) if (o !== z && o.vivo && dist(o, h) < 3.5) { const e = dist(o, z) || 1; rx += (z.x - o.x) / e / e; ry += (z.y - o.y) / e / e; }   // (alejarse de los otros cazadores)
     const tx = -Math.sin(a), ty = Math.cos(a), k = rx * tx + ry * ty, th = Math.atan2(ty * Math.sign(k || 1), tx * Math.sign(k || 1));   // (moverse por el borde del circulo, hacia donde hay lugar)
     const radio = d < 2 ? th + Math.sign(ang(th - a)) * 0.6 : th;
     return {giro: girarA(z, radio), vel: 0.7, accion: 0, gem: false};
   }},
];

// --- tutoria 2 (nivel 2: dos presas) ---
const presaFoco = (ep, z) => {   // (entre las presas que ve, la que ya tiene mas zombis encima: concentrar)
  let mejor = null, ms = -1e9; for (const h of ep.humanos) { if (!h.vivo) continue; const d = dist(h, z); if (d > 15 || !seVe(ep.m, z.x, z.y, h.x, h.y)) continue;
    const s = 2 * ep.zombis.filter(o => o.vivo && o !== z && dist(o, h) < 3).length - 0.15 * d; if (s > ms) { ms = s; mejor = h; } } return mejor; };
REGLAS.push(
  {nombre: 'foco-arrastre', fuente: 'intuicion de la tutora, sobre el codigo de BodyDamage: con 3 zombis atacando a la vez te tiran al piso y moris (EndDeath); repartirse entre dos presas desperdicia eso',
   politica(ep, z, v) {
     const h = presaFoco(ep, z); if (!h) return v;
     const d = dist(h, z), a = Math.atan2(h.y - z.y, h.x - z.x), f = mira(h, z), otros = pegados(ep, h, z, 1.5);
     if (d < 2.4 && f > 0.3 && otros === 0) { const lado = Math.sign((Math.cos(h.a) * (z.y - h.y) - Math.sin(h.a) * (z.x - h.x))) || 1; return {giro: girarA(z, a + lado * (d < 1.6 ? 2.0 : 1.4)), vel: 0.8, accion: 0, gem: true}; }
     return {giro: girarA(z, a), vel: 1, accion: d < 2.6 ? 1 : v.accion, gem: true};
   }},
  {nombre: 'leonas-stander1992', fuente: 'Stander 1992, Behav Ecol Sociobiol: las leonas cazan en formacion; las "alas" rodean y atacan, el "centro" espera y atrapa a la presa que huye hacia el',
   politica(ep, z, v) {
     if (z.ve < 0) return v;
     const h = ep.humanos[z.ve], d = dist(h, z), a = Math.atan2(h.y - z.y, h.x - z.x), f = mira(h, z), ala = ep.zombis.indexOf(z) % 2 === 1;
     if (!ala) {   // (centro: se acerca de frente hasta 3 casillas y espera; si la presa viene, ataca)
       if (d < 1.8) return {giro: girarA(z, a), vel: 1, accion: 1, gem: true};
       return {giro: girarA(z, a), vel: d > 3.2 ? 1 : 0.1, accion: 0, gem: true}; }
     if (f > -0.3 && d < 5) { const lado = Math.sign((Math.cos(h.a) * (z.y - h.y) - Math.sin(h.a) * (z.x - h.x))) || 1; return {giro: girarA(z, a + lado * (d < 3 ? 1.9 : 1.2)), vel: 1, accion: 0, gem: false}; }   // (ala: rodear hasta quedar a la espalda)
     return {giro: girarA(z, a), vel: 1, accion: d < 2.6 ? 1 : v.accion, gem: false};   // (ala a la espalda: ataque)
   }});

// --- tutoria 3 (nivel 3: tres presas) ---
const presaRezagada = (ep, z) => {   // (la presa mas lejos de los otros humanos -que no la pueden ayudar- y con mas zombis encima)
  let mejor = null, ms = -1e9; for (const h of ep.humanos) { if (!h.vivo) continue; const d = dist(h, z); if (d > 15 || !seVe(ep.m, z.x, z.y, h.x, h.y)) continue;
    let sola = 99; for (const o of ep.humanos) if (o !== h && o.vivo) sola = Math.min(sola, dist(o, h));
    const s = 2 * ep.zombis.filter(o => o.vivo && o !== z && dist(o, h) < 3).length + 0.3 * Math.min(sola, 10) - 0.15 * d; if (s > ms) { ms = s; mejor = h; } } return mejor; };
REGLAS.push(
  {nombre: 'rezagado', fuente: 'intuicion de la tutora: los predadores eligen al que quedo aislado del grupo; con tres humanos, el que esta solo no recibe ayuda',
   politica(ep, z, v) {
     const h = presaRezagada(ep, z); if (!h) return v;
     const d = dist(h, z), a = Math.atan2(h.y - z.y, h.x - z.x), f = mira(h, z), otros = pegados(ep, h, z, 1.5);
     if (d < 2.4 && f > 0.3 && otros === 0) { const lado = Math.sign((Math.cos(h.a) * (z.y - h.y) - Math.sin(h.a) * (z.x - h.x))) || 1; return {giro: girarA(z, a + lado * (d < 1.6 ? 2.0 : 1.4)), vel: 0.8, accion: 0, gem: true}; }
     return {giro: girarA(z, a), vel: 1, accion: d < 2.6 ? 1 : v.accion, gem: true};
   }},
  {nombre: 'fuera-de-vista', fuente: 'foros de PZ (Steam, "every hidden way you can die"): los jugadores mueren rodeados por zombis que no veian; llegar por fuera de su cono de vision, callado, y morder de atras',
   politica(ep, z, v) {
     if (z.ve < 0) return v;
     const h = ep.humanos[z.ve], d = dist(h, z), a = Math.atan2(h.y - z.y, h.x - z.x), f = mira(h, z);
     if (f > -0.2 && d > 1.6 && d < 9) {   // (estoy en su cono de vision: me corro de costado, sin gemir, hasta quedar atras)
       const lado = Math.sign((Math.cos(h.a) * (z.y - h.y) - Math.sin(h.a) * (z.x - h.x))) || 1; return {giro: girarA(z, a + lado * 1.5), vel: 1, accion: 0, gem: false}; }
     return {giro: girarA(z, a), vel: 1, accion: d < 2.6 ? 1 : v.accion, gem: d < 1.5};   // (desde atras: directo a morder; gime recien encima)
   }});

// --- tutoria 4 (nivel 4: cuatro presas, dos zombis por humano) ---
REGLAS.push(
  {nombre: 'esperar-a-ser-tres', fuente: 'intuicion de la tutora, sobre el codigo de BodyDamage: con 3 atacando a la vez es muerte instantanea (EndDeath); no comprometerse hasta que haya otros 2 cerca de la presa',
   politica(ep, z, v) {
     const h = presaFoco(ep, z); if (!h) return v;
     const d = dist(h, z), a = Math.atan2(h.y - z.y, h.x - z.x), cerca = ep.zombis.filter(o => o !== z && o.vivo && !(o.piso > 0) && dist(o, h) < 3).length;
     if (cerca < 2 && d < 3) { const lado = Math.sign((Math.cos(h.a) * (z.y - h.y) - Math.sin(h.a) * (z.x - h.x))) || 1; return {giro: girarA(z, d < 2.3 ? a + lado * 2.2 : a + lado * 1.57), vel: 0.6, accion: 0, gem: true}; }   // (rondar a 2,5 casillas, llamando)
     return {giro: girarA(z, a), vel: 1, accion: d < 2.6 ? 1 : v.accion, gem: true};
   }},
  {nombre: 'lanchester', fuente: 'ley cuadratica de Lanchester (1916): la fuerza que se concentra en un punto gana mas que proporcionalmente; toda la manada elige la MISMA presa (la mas cercana al centro del grupo) y ataca junta',
   politica(ep, z, v) {
     const vivos = ep.zombis.filter(o => o.vivo); let cx = 0, cy = 0; vivos.forEach(o => { cx += o.x; cy += o.y; }); cx /= vivos.length; cy /= vivos.length;
     let h = null, md = 1e9; for (const o of ep.humanos) { if (!o.vivo || o.sano < 0.001) continue; const d = Math.hypot(o.x - cx, o.y - cy); if (d < md) { md = d; h = o; } }
     if (!h || dist(h, z) > 18) return v;
     const d = dist(h, z), a = Math.atan2(h.y - z.y, h.x - z.x), ve = seVe(ep.m, z.x, z.y, h.x, h.y);
     if (!ve) { const r = util.rumbo(ep, z, h.x, h.y, 'z'); return {giro: girarA(z, r ?? a), vel: 1, accion: v.accion, gem: false}; }
     return {giro: girarA(z, a), vel: 1, accion: d < 2.6 ? 1 : v.accion, gem: true};
   }});
