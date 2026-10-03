// JUNTAR LAS ISLAS (GitHub Actions): toma los campeones de cada isla (resultados/isla-*/campeones.json), los prueba a
// todos en los mismos 144 barrios (nivel mezcla: 1 a 4 sobrevivientes) contra el vanilla, y deja al mejor de cada
// estrategia en campeones.json y el estado de la mejor isla en estrategias/, para que la proxima tanda arranque de ahi.
// Uso: node juntar.mjs [carpeta=resultados]
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {vivir} from './mundo.js'; import {REGLAS} from './tutor/reglas.js';
const aqui = path.dirname(fileURLToPath(import.meta.url)), raiz = path.join(aqui, process.argv[2] || 'resultados');
const BASE = JSON.parse(fs.readFileSync(path.join(aqui, 'estrategias', 'nivel.json'), 'utf8')).base, base = REGLAS.find(r => r.nombre === BASE)?.politica;
const PRUEBA = Array.from({length: 144}, (_, i) => 90001 + i);
const medir = (g, conBase, barrios = PRUEBA) => { let a = 0; for (const s of barrios) { const nh = 1 + (s % 4); a += vivir(g ? Float32Array.from(g) : null, s, {nh, nz: 8, cerca: true, duracion: 45, base: conBase ? base : null}).apt / nh; } return a / barrios.length; };
const islas = fs.existsSync(raiz) ? fs.readdirSync(raiz).filter(d => fs.existsSync(path.join(raiz, d, 'campeones.json'))) : [];
const van = medir(null, false); console.log(`VANILLA (mezcla 1-4): ${van.toFixed(4)} por sobreviviente`);
const previo = fs.existsSync(path.join(aqui, 'campeones.json')) ? JSON.parse(fs.readFileSync(path.join(aqui, 'campeones.json'), 'utf8')) : {};
const cands = [];
for (const [est, c] of Object.entries(previo)) if (c && c.pesos) cands.push({est, isla: 'anterior', pesos: c.pesos});
for (const isla of islas) { const C = JSON.parse(fs.readFileSync(path.join(raiz, isla, 'campeones.json'), 'utf8'));
  for (const [est, c] of Object.entries(C)) if (c && c.pesos) cands.push({est, isla, pesos: c.pesos}); }
for (const c of cands) { c.apt = medir(c.pesos, true); console.log(`${c.isla.padEnd(10)} ${c.est.padEnd(11)} ${c.apt.toFixed(4)} (${((c.apt / van - 1) * 100).toFixed(0)}% vs vanilla)`); }
// SEGUNDA VUELTA: elegir al mejor de 85 sobre los mismos 144 barrios premia la suerte (el primer "campeon" bajo de 0,253 a
// 0,199 en barrios nuevos). Los 3 mejores de cada estrategia se confirman en 400 barrios que cambian en cada tanda.
const s1 = 1000000 + Math.floor(Date.now() / 60000) % 500000 * 2, NUEVOS = Array.from({length: 400}, (_, i) => s1 + i);
const vanN = medir(null, false, NUEVOS); console.log(`VANILLA en 400 barrios nuevos (desde ${s1}): ${vanN.toFixed(4)}`);
const mejores = {};
for (const est of [...new Set(cands.map(c => c.est))]) { const fin = cands.filter(c => c.est === est).sort((a, b) => b.apt - a.apt).slice(0, 3);
  for (const c of fin) { c.apt1 = c.apt; c.apt = medir(c.pesos, true, NUEVOS); console.log(`FINAL ${c.isla.padEnd(10)} ${est.padEnd(11)} 144: ${c.apt1.toFixed(4)} -> nuevos: ${c.apt.toFixed(4)} (${((c.apt / vanN - 1) * 100).toFixed(0)}% vs vanilla)`); if (!mejores[est] || c.apt > mejores[est].apt) mejores[est] = c; } }
const salida = {vanilla: {apt: vanN, nivel: 'mezcla', barrios: s1}, base: {nombre: BASE}};
for (const [est, c] of Object.entries(mejores)) salida[est] = {apt: c.apt, isla: c.isla, pesos: c.pesos};
fs.writeFileSync(path.join(aqui, 'campeones.json'), JSON.stringify(salida));
const top = Object.values(mejores).sort((a, b) => b.apt - a.apt)[0];
if (top && top.isla !== 'anterior') { const desde = path.join(raiz, top.isla, 'estrategias');   // (el estado de la isla ganadora pasa a ser el punto de partida)
  if (fs.existsSync(desde)) for (const f of fs.readdirSync(desde)) if (f !== 'nivel.json') fs.copyFileSync(path.join(desde, f), path.join(aqui, 'estrategias', f)); }
const linea = `${new Date().toISOString()} mejor ${top ? top.est + ' de ' + top.isla + ' ' + top.apt.toFixed(4) : '-'} vs vanilla ${vanN.toFixed(4)} (${top ? ((top.apt / vanN - 1) * 100).toFixed(0) : 0}%) en 400 barrios nuevos con ${islas.length} islas`;
fs.appendFileSync(path.join(aqui, 'historial-nube.log'), linea + '\n'); console.log(linea);
