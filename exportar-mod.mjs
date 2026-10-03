// Pasa el cerebro campeon del torneo al mod de PZ: escribe ZN_Pesos.lua en las dos copias del mod (mods y Workshop si existe).
// Uso: node exportar-mod.mjs [estrategia=sep-CMA-ES]
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {ZOMBI} from './mundo.js'; import {OCULTAS, nPesos} from './red.js';
const aqui = path.dirname(fileURLToPath(import.meta.url)), cual = process.argv[2] || 'sep-CMA-ES';
const C = JSON.parse(fs.readFileSync(path.join(aqui, 'campeones.json'), 'utf8')), c = C[cual];
if (!c || !c.pesos || c.pesos.length !== nPesos(ZOMBI.nEnt, ZOMBI.nAcc)) throw new Error('no hay campeon ' + cual);
const filas = []; for (let i = 0; i < c.pesos.length; i += 20) filas.push(c.pesos.slice(i, i + 20).map(w => +(+w).toFixed(4)).join(','));
const lua = `-- GENERADO por zombis-neuronales/exportar-mod.mjs (no editar a mano)
-- cerebro: campeon ${cual} del torneo, base ${C.base ? C.base.nombre : '-'}; infeccion en prueba ${(c.apt).toFixed(3)} vs vanilla ${(C.vanilla.apt).toFixed(3)} (nivel ${C.vanilla.nivel})
ZN = ZN or {}
ZN.NE = ${ZOMBI.nEnt}; ZN.H = ${OCULTAS}; ZN.NS = ${2 + ZOMBI.nAcc}
ZN.ORIGEN = "${cual}"
ZN.PESOS = {
${filas.join(',\n')}
}
`;
const destinos = ['C:/Users/Fabri/Zomboid/mods/ZOMBISNEURONALES/42/media/lua/shared/ZN_Pesos.lua'];
for (const d of destinos) { fs.mkdirSync(path.dirname(d), {recursive: true}); fs.writeFileSync(d, lua); console.log('escrito', d, (lua.length / 1024).toFixed(0) + ' KB'); }
