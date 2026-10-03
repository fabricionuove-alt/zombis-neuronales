// ENTRENAR CON LO QUE PASA EN EL JUEGO (evolucion en vivo, como rtNEAT en NERO): lee Zomboid\Lua\zn_registro.txt,
// le da a cada cerebro de la poblacion el credito de las heridas que causo (mordida 1, laceracion 0,25, rasguno 0,07,
// repartido entre los zombis neuronales que estaban encima), dividido por cuantos zombis con ese cerebro se soltaron.
// Se quedan los mejores, se mutan, y se escribe la poblacion nueva en Zomboid\Lua\zn_poblacion.txt.
// Uso: node entrenar-ingame.mjs [analizar]   (sin poblacion: la crea con el campeon de campeones.json + 7 variantes)
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const aqui = path.dirname(fileURLToPath(import.meta.url)), LUA = process.env.ZN_LUA || 'C:/Users/Fabri/Zomboid/Lua', DESDE = process.env.ZN_DESDE || 'Genetico';
const REG = path.join(LUA, 'zn_registro.txt'), POB = path.join(LUA, 'zn_poblacion.txt'), HIST = path.join(LUA, 'zn_historial.json');
const TAM = 8, VALOR = {mordida: 1, laceracion: 0.25, rasguno: 0.07};
let s0 = Date.now() % 100000; const u = () => { s0 = (Math.imul(s0, 1664525) + 1013904223) >>> 0; return (s0 + 1) / 4294967297; };
const gauss = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(6.2832 * u());
const leerPob = () => fs.existsSync(POB) ? fs.readFileSync(POB, 'utf8').trim().split('\n').filter(Boolean).map(l => { const [id, w] = l.split(';'); return {id, W: w.split(',').map(Number)}; }) : [];
const escribirPob = p => { fs.mkdirSync(LUA, {recursive: true}); fs.writeFileSync(POB, p.map(g => g.id + ';' + g.W.map(w => +w.toFixed(4)).join(',')).join('\n') + '\n'); };
const hist = fs.existsSync(HIST) ? JSON.parse(fs.readFileSync(HIST, 'utf8')) : {generacion: 0, leidoHasta: 0, puntos: {}};

// ---- leer el registro (solo lo nuevo desde la ultima vez) ----
const lineas = fs.existsSync(REG) ? fs.readFileSync(REG, 'utf8').split('\n').filter(Boolean) : [];
const nuevas = lineas.filter(l => +l.split(';')[0] > hist.leidoHasta);
const R = {neuronal: {soltados: 0, heridas: {rasguno: 0, laceracion: 0, mordida: 0}, lados: {frente: 0, costado: 0, atras: 0}, multi: 0, muertos: 0, infeccion: 0},
           vanilla: {soltados: 0, heridas: {rasguno: 0, laceracion: 0, mordida: 0}, lados: {frente: 0, costado: 0, atras: 0}, multi: 0, muertos: 0, infeccion: 0}};
const porGenoma = {}; const g = id => (porGenoma[id] ??= {soltados: 0, credito: 0});
let estados = {n: 0, rodear: 0, atacar: 0, gemidos: 0}, muertes = [];
for (const l of nuevas) { const c = l.split(';'), ev = c[1];
  if (ev === 'SOLTAR') { R[c[2]].soltados += +c[3]; if (c[4]) c[4].split(',').filter(Boolean).forEach(id => g(id).soltados++); }
  else if (ev === 'HERIDA') { const [tipo, , lado, neur, vani] = [c[2], c[3], c[4], +c[5], +c[6]], gens = (c[8] || '').split(',').filter(Boolean);
    const grupo = neur >= vani ? 'neuronal' : 'vanilla'; if (!neur && !vani) continue;
    R[grupo].heridas[tipo]++; R[grupo].lados[lado]++; if (neur + vani >= 2) R[grupo].multi++; R[grupo].infeccion += VALOR[tipo];
    if (gens.length) gens.forEach(id => { g(id).credito += VALOR[tipo] / gens.length; }); }
  else if (ev === 'ZOMBI_MUERTO') R[c[2]].muertos++;
  else if (ev === 'ESTADO') { estados.n++; estados.rodear += +c[4]; estados.atacar += +c[5]; estados.gemidos += +c[6]; }
  else if (ev === 'MUERTE') muertes.push({neuronales: +c[2], vanilla: +c[3]}); }

console.log(`registro: ${nuevas.length} lineas nuevas (de ${lineas.length})`);
for (const [k, r] of Object.entries(R)) { if (!r.soltados) continue; const tot = r.heridas.rasguno + r.heridas.laceracion + r.heridas.mordida || 1;
  console.log(`${k.padEnd(9)} soltados ${r.soltados} | heridas ${tot === 1 && !r.heridas.rasguno && !r.heridas.laceracion && !r.heridas.mordida ? 0 : tot} (rasg ${r.heridas.rasguno} lac ${r.heridas.laceracion} mord ${r.heridas.mordida}) | de frente/costado/atras ${r.lados.frente}/${r.lados.costado}/${r.lados.atras} | con 2+ encima ${r.multi} | infeccion por zombi soltado ${(r.infeccion / r.soltados).toFixed(3)} | zombis muertos ${r.muertos}`); }
if (estados.n) console.log(`neuronales, decisiones: rodear ${estados.rodear} atacar ${estados.atacar} gemidos ${estados.gemidos}`);
if (muertes.length) console.log('tus muertes:', JSON.stringify(muertes));
if (process.argv.includes('analizar')) process.exit(0);

// ---- puntuar y evolucionar la poblacion ----
let pob = leerPob();
if (!pob.length) { const C = JSON.parse(fs.readFileSync(path.join(aqui, 'campeones.json'), 'utf8')), best = [DESDE, C[DESDE]];   // (el mismo campeon que tiene el mod: exportar-mod.mjs)
  pob = [{id: 'g0-campeon', W: best[1].pesos.map(Number)}]; for (let i = 1; i < TAM; i++) pob.push({id: `g0-v${i}`, W: pob[0].W.map(w => w + 0.03 * gauss())});
  escribirPob(pob); console.log(`poblacion nueva (${TAM} cerebros desde el campeon ${best[0]}) -> ${POB}`); }
else {
  for (const [id, p] of Object.entries(porGenoma)) { const h = (hist.puntos[id] ??= {soltados: 0, credito: 0}); h.soltados += p.soltados; h.credito += p.credito; }
  const nota = id => { const h = hist.puntos[id]; return h && h.soltados ? (h.credito + 0.05) / (h.soltados + 9) : 0.05 / 9; };   // (con prior: hasta que no se suelten varios, nadie gana por suerte)
  const conDatos = pob.filter(x => (hist.puntos[x.id]?.soltados || 0) >= 9);
  pob.forEach(x => console.log(`  ${x.id.padEnd(14)} soltados ${hist.puntos[x.id]?.soltados || 0} credito ${(hist.puntos[x.id]?.credito || 0).toFixed(2)} nota ${nota(x.id).toFixed(4)}`));
  if (conDatos.length < TAM / 2) console.log(`todavia pocos datos (${conDatos.length}/${TAM} cerebros con 9+ soltados): la poblacion sigue igual, soltá mas zombis`);
  else { hist.generacion++; const orden = [...pob].sort((a, b) => nota(b.id) - nota(a.id)), padres = orden.slice(0, TAM / 2);
    const hijos = Array.from({length: TAM - padres.length}, (_, i) => { const a = padres[i % padres.length], b = padres[Math.floor(u() * padres.length)];
      return {id: `g${hist.generacion}-h${i}`, W: a.W.map((w, q) => (u() < 0.5 ? w : b.W[q]) + 0.03 * gauss())}; });
    pob = [...padres, ...hijos]; escribirPob(pob); console.log(`generacion ${hist.generacion}: quedan ${padres.map(p => p.id).join(', ')}; ${hijos.length} hijos nuevos -> ${POB}`); }
}
hist.leidoHasta = lineas.length ? +lineas[lineas.length - 1].split(';')[0] : hist.leidoHasta;
fs.writeFileSync(HIST, JSON.stringify(hist, null, 1));
