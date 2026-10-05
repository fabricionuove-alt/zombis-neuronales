// EL EXPERIMENTO: el mismo mundo, muchas veces, por cada receta. Una corrida sola no dice nada (dos corridas iguales dan
// resultados opuestos), asi que cada receta de desierto/experimento.json se corre REPLICAS veces, cada una con su SEMILLA
// (1, 2, 3...: la misma semilla da el mismo mundo, numero por numero), SIN que llegue nadie de afuera cuando una especie se
// extingue. Se mide cuanto aguanta cada especie y cuantos son, con promedio y dispersion.
//   L=1200 node desierto/replicas.mjs        (L = el lado del mundo; lo pone la tarea, de experimento.json)
// Deja en desierto/experimento/:
//   series.csv     receta, replica, semilla, minuto, especie, n, biomasa   (todo, en formato largo, para analizarlo con lo que se quiera)
//   replicas.csv   receta, replica, semilla, especie, minutoDeExtincion (vacio = llego viva al final), nMedio, nFinal
//   resultado.json el resumen por receta y especie: en cuantas replicas sobrevivio, mediana del minuto de extincion, n medio y desvio,
//                  y como se va asentando el promedio a medida que se suman replicas (para ver si alcanzan: Lee et al. 2015)
// El simulador se baja del sitio del juego, como en nube.mjs.
import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
import * as m from './sim/mundoVivo.js';
const aqui = path.dirname(fileURLToPath(import.meta.url)), en = f => path.join(aqui, f);
const X = JSON.parse(fs.readFileSync(en('experimento.json'), 'utf8')), HORAS = X.horas || 4, N = X.replicas || 10, CADA = 900, TOPE = (X.topeMinutos || 300) * 60000;
const semillaRed = JSON.parse(fs.readFileSync(en('sim/cresta-salvaje.json'), 'utf8')).pesos, coyoteF = en('sim/coyote-semilla.json'), coyoteRed = fs.existsSync(coyoteF) && fs.statSync(coyoteF).size > 100 ? JSON.parse(fs.readFileSync(coyoteF, 'utf8')).pesos : semillaRed, semillas = {cerdo: semillaRed, coyote: coyoteRed}, d = (m.L / 1800) ** 2;
const dir = en('experimento'); fs.mkdirSync(dir, {recursive: true});
const series = ['receta,replica,semilla,minuto,especie,n,biomasa'], reps = ['receta,replica,semilla,especie,minutoDeExtincion,nMedio,nFinal'];
const media = l => l.reduce((a, b) => a + b, 0) / (l.length || 1), desvio = l => { if (l.length < 2) return 0; const u = media(l); return Math.sqrt(l.reduce((a, b) => a + (b - u) ** 2, 0) / (l.length - 1)); };
const mediana = l => { if (!l.length) return null; const s = [...l].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; }, r2 = v => Math.round(v * 100) / 100;
const biomasa = (M, k) => { let b = 0; if (M.pob[k]) { for (const a of M.pob[k]) if (a.vivo) b += a.cuerpo || 0; } else for (const K of m.grupos(M)) for (const a of K.miembros) if (a.vivo && a.esp === k) b += a.cuerpo || 0; return b; };
const t0 = Date.now(), resumen = {hecho: new Date().toISOString(), lado: m.L, horas: HORAS, replicas: N, sinLlegadas: true, recetas: []}; let cortado = false;
for (const rc of X.recetas) {
  const porEsp = {}; for (const k of m.ESPECIES) porEsp[k] = {ext: [], nMedio: [], nFinal: [], vivas: 0}; let hechas = 0;
  for (let rep = 1; rep <= N; rep++) { if (Date.now() - t0 > TOPE) { cortado = true; break; }
    m.sembrar(rep);
    const M = m.crearMundo({receta: rc.receta, semillas, sinLlegadas: true, n: {cerdo: Math.round(90 * d), coyote: Math.round(15 * d)}, tribus: {steve: Math.round(18 * d), arana: Math.round(5 * d)}, nOasis: Math.round(12 * d)});
    const ext = {}, suma = {}; let muestras = 0; for (const k of m.ESPECIES) suma[k] = 0;
    for (let t = 0; t < HORAS * 3600; t += CADA) { for (let k = 0; k < CADA * 2; k++) m.paso(M, 0.5); const c = m.censo(M), min = Math.round(M.t / 60); muestras++;
      for (const k of m.ESPECIES) { const n = c.esp[k].n; suma[k] += n; if (!n && ext[k] === undefined) ext[k] = min; series.push([rc.nombre, rep, rep, min, k, n, r2(biomasa(M, k))].join(',')); }
      series.push([rc.nombre, rep, rep, min, 'mata', c.matas.matas, ''].join(',')); }
    const c = m.censo(M); hechas++;
    for (const k of m.ESPECIES) { const p = porEsp[k], nm = suma[k] / muestras; if (ext[k] === undefined) p.vivas++; else p.ext.push(ext[k]); p.nMedio.push(nm); p.nFinal.push(c.esp[k].n); reps.push([rc.nombre, rep, rep, k, ext[k] ?? '', r2(nm), c.esp[k].n].join(',')); }
    console.log(`${rc.nombre} · replica ${rep}/${N} · ` + m.ESPECIES.map(k => `${k} ${c.esp[k].n}${ext[k] !== undefined ? ' (extinta al min ' + ext[k] + ')' : ''}`).join(' · ') + ` · ${Math.round((Date.now() - t0) / 1000)} s`); }
  const R = {nombre: rc.nombre, receta: rc.receta || {}, replicas: hechas, especies: {}};
  for (const k of m.ESPECIES) { const p = porEsp[k]; R.especies[k] = {sobrevive: p.vivas, de: hechas, medianaMinutoExtincion: mediana(p.ext), nMedio: r2(media(p.nMedio)), desvio: r2(desvio(p.nMedio)), nFinalMedio: r2(media(p.nFinal)), nFinalDesvio: r2(desvio(p.nFinal)),
      asentamiento: p.nMedio.map((_, i) => r2(media(p.nMedio.slice(0, i + 1))))}; }   // (el promedio con 1, 2, 3... replicas: si a las ultimas ya no se mueve, alcanzan)
  resumen.recetas.push(R); if (cortado) break;
}
resumen.cortado = cortado; resumen.minutosDeReloj = Math.round((Date.now() - t0) / 60000);
fs.writeFileSync(path.join(dir, 'series.csv'), series.join('\n') + '\n'); fs.writeFileSync(path.join(dir, 'replicas.csv'), reps.join('\n') + '\n'); fs.writeFileSync(path.join(dir, 'resultado.json'), JSON.stringify(resumen, null, 1));
console.log('\nRESUMEN (mundo de ' + m.L + ' m, ' + HORAS + ' h, sin que llegue nadie de afuera)');
for (const R of resumen.recetas) { console.log('· ' + R.nombre + ' (' + R.replicas + ' replicas)'); for (const k of m.ESPECIES) { const e = R.especies[k]; console.log(`    ${k.padEnd(7)} sobrevive en ${e.sobrevive}/${e.de} · se extingue al minuto ${e.medianaMinutoExtincion ?? '-'} (mediana) · son ${e.nMedio} ± ${e.desvio} en promedio`); } }
