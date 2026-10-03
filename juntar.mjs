// JUNTAR LAS ISLAS (GitHub Actions): toma los campeones de cada isla (resultados/isla-*/campeones.json), los prueba a
// todos en los mismos 144 barrios (nivel mezcla: 1 a 4 sobrevivientes) contra el vanilla, y deja al mejor de cada
// estrategia en campeones.json y el estado de la mejor isla en estrategias/, para que la proxima tanda arranque de ahi.
// Uso: node juntar.mjs [carpeta=resultados]
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {vivir} from './mundo.js'; import {REGLAS} from './tutor/reglas.js';
const aqui = path.dirname(fileURLToPath(import.meta.url)), raiz = path.join(aqui, process.argv[2] || 'resultados');
const BASE = JSON.parse(fs.readFileSync(path.join(aqui, 'estrategias', 'nivel.json'), 'utf8')).base, base = REGLAS.find(r => r.nombre === BASE)?.politica;
const PRUEBA = Array.from({length: 144}, (_, i) => 90001 + i);
const medir = (g, conBase) => { let a = 0; for (const s of PRUEBA) { const nh = 1 + (s % 4); a += vivir(g ? Float32Array.from(g) : null, s, {nh, nz: 8, cerca: true, duracion: 45, base: conBase ? base : null}).apt / nh; } return a / PRUEBA.length; };
const islas = fs.existsSync(raiz) ? fs.readdirSync(raiz).filter(d => fs.existsSync(path.join(raiz, d, 'campeones.json'))) : [];
const van = medir(null, false); console.log(`VANILLA (mezcla 1-4): ${van.toFixed(4)} por sobreviviente`);
const previo = fs.existsSync(path.join(aqui, 'campeones.json')) ? JSON.parse(fs.readFileSync(path.join(aqui, 'campeones.json'), 'utf8')) : {};
const cands = [];
for (const [est, c] of Object.entries(previo)) if (c && c.pesos) cands.push({est, isla: 'anterior', pesos: c.pesos});
for (const isla of islas) { const C = JSON.parse(fs.readFileSync(path.join(raiz, isla, 'campeones.json'), 'utf8'));
  for (const [est, c] of Object.entries(C)) if (c && c.pesos) cands.push({est, isla, pesos: c.pesos}); }
for (const c of cands) { c.apt = medir(c.pesos, true); console.log(`${c.isla.padEnd(10)} ${c.est.padEnd(11)} ${c.apt.toFixed(4)} (${((c.apt / van - 1) * 100).toFixed(0)}% vs vanilla)`); }
const mejores = {}; for (const c of cands) if (!mejores[c.est] || c.apt > mejores[c.est].apt) mejores[c.est] = c;
const salida = {vanilla: {apt: van, nivel: 'mezcla'}, base: {nombre: BASE}};
for (const [est, c] of Object.entries(mejores)) salida[est] = {apt: c.apt, isla: c.isla, pesos: c.pesos};
fs.writeFileSync(path.join(aqui, 'campeones.json'), JSON.stringify(salida));
const top = Object.values(mejores).sort((a, b) => b.apt - a.apt)[0];
if (top && top.isla !== 'anterior') { const desde = path.join(raiz, top.isla, 'estrategias');   // (el estado de la isla ganadora pasa a ser el punto de partida)
  if (fs.existsSync(desde)) for (const f of fs.readdirSync(desde)) if (f !== 'nivel.json') fs.copyFileSync(path.join(desde, f), path.join(aqui, 'estrategias', f)); }
const linea = `${new Date().toISOString()} mejor ${top ? top.est + ' de ' + top.isla + ' ' + top.apt.toFixed(4) : '-'} vs vanilla ${van.toFixed(4)} (${top ? ((top.apt / van - 1) * 100).toFixed(0) : 0}%) con ${islas.length} islas`;
fs.appendFileSync(path.join(aqui, 'historial-nube.log'), linea + '\n'); console.log(linea);
