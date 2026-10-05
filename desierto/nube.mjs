// EL DESIERTO VIVO, ENTRENANDO EN LA NUBE (GitHub Actions): corre el mundo MINUTOS minutos de reloj, siguiendo desde donde
// quedo (mundo.json), y deja: mundo.json (el mundo entero: se abre en el visor y se lleva al juego), estado.json (un resumen
// chico) e historia.csv (el censo, una fila por hora de mundo). "Entrenar" aca es dejar vivir: nadie pone puntaje.
//   MINUTOS=30 L=1200 node desierto/nube.mjs
// La receta del mundo online: desierto/receta.json (solo lo que cambia respecto de la base; ver recetaBase en mundoVivo.js).
import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
// EL SIMULADOR NO ESTA EN ESTE REPO: la tarea lo baja del sitio del juego (https://caminante-g1.vercel.app/sim/) a desierto/sim/
// antes de correr. Asi el juego, el visor y esto corren siempre el mismo archivo.
import * as m from './sim/mundoVivo.js';
const aqui = path.dirname(fileURLToPath(import.meta.url)), en = f => path.join(aqui, f), e = process.env, MINUTOS = +(e.MINUTOS || 30);
const semilla = JSON.parse(fs.readFileSync(en('sim/cresta-salvaje.json'), 'utf8')).pesos, semillas = {cerdo: semilla, coyote: semilla};
const receta = fs.existsSync(en('receta.json')) ? JSON.parse(fs.readFileSync(en('receta.json'), 'utf8')) : null;
let M = null, desde = 'cero';
if (fs.existsSync(en('mundo.json'))) { try { const f = JSON.parse(fs.readFileSync(en('mundo.json'), 'utf8')); if (f.L === m.L && f.matas) { M = m.desdeFoto(f, {semillas, receta}); desde = `la hora ${(M.t / 3600).toFixed(1)}`; } } catch (err) { console.log('el mundo guardado no sirve, arranco de cero:', err.message); } }
if (!M) { const d = (m.L / 1800) ** 2; M = m.crearMundo({receta, semillas, n: {cerdo: Math.round(90 * d), coyote: Math.round(15 * d)}, tribus: {steve: Math.round(18 * d), arana: Math.round(5 * d)}, nOasis: Math.round(12 * d)}); }
console.log(`mundo de ${m.L} m, desde ${desde}, ${MINUTOS} minutos de reloj · receta ${JSON.stringify(m.diferencia(M.R))}`);
const csv = en('historia.csv'), cols = ['hora', 'matas', ...m.ESPECIES.flatMap(k => [k, k + 'Gen', k + 'Llegadas'])];
if (!fs.existsSync(csv)) fs.writeFileSync(csv, cols.join(',') + '\n');
const t0 = Date.now(), h0 = M.t; let proxHora = (Math.floor(M.t / 3600) + 1) * 3600;
while (Date.now() - t0 < MINUTOS * 60000) { for (let k = 0; k < 400; k++) m.paso(M, 0.5);
  if (M.t >= proxHora) { proxHora += 3600; const c = m.censo(M); fs.appendFileSync(csv, [Math.round(M.t / 3600), c.matas.matas, ...m.ESPECIES.flatMap(k => [c.esp[k].n, c.esp[k].genMedia, c.esp[k].llegadas])].join(',') + '\n'); } }
const c = m.censo(M);
fs.writeFileSync(en('mundo.json'), JSON.stringify(m.foto(M)));
fs.writeFileSync(en('estado.json'), JSON.stringify({actualizado: new Date().toISOString(), horasDeMundo: +(M.t / 3600).toFixed(1), horasEnEstaTanda: +((M.t - h0) / 3600).toFixed(1), minutosDeReloj: MINUTOS, lado: m.L, receta: m.diferencia(M.R), matas: c.matas, especies: c.esp, tribus: c.tribus, hizo: c.hizo, muertes: c.muertes, llegadas: c.llegadas}, null, 1));
console.log(`listo: +${((M.t - h0) / 3600).toFixed(1)} h de mundo (van ${(M.t / 3600).toFixed(1)}). ` + m.ESPECIES.map(k => `${k} ${c.esp[k].n} (gen ${c.esp[k].genMedia})`).join(' · '));
