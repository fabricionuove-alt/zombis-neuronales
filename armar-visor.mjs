// Arma visor.html (un solo archivo, se abre con doble clic): mete adentro red.js, mundo.js, archivo.json y campeones.json.
// Uso: node armar-visor.mjs
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const limpiar = f => fs.readFileSync(path.join(aqui, f), 'utf8').replace(/^import .*$/gm, '').replace(/^export /gm, '');
const camp = fs.existsSync(path.join(aqui, 'campeones.json')) ? fs.readFileSync(path.join(aqui, 'campeones.json'), 'utf8') : '{}';
const arch = fs.existsSync(path.join(aqui, 'archivo.json')) ? fs.readFileSync(path.join(aqui, 'archivo.json'), 'utf8') : '{"celdas":{}}';
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zombis neuronales</title>
<style>
:root{--fondo:#0e0f0c;--panel:#171913;--texto:#d9dccf;--tenue:#7d8270;--pared:#3a3d33;--interior:#1d2019;--suelo:#12140f;--puerta:#8a6a3a;--rota:#7a2a22;--ventana:#4b7b8f;--humano:#f2f2ea}
*{box-sizing:border-box}body{margin:0;background:var(--fondo);color:var(--texto);font:13px/1.4 ui-monospace,Consolas,monospace}
main{display:flex;gap:16px;padding:16px;flex-wrap:wrap}canvas{background:var(--suelo);max-width:100%;height:auto;image-rendering:pixelated}
aside{width:300px;max-width:100%}h1{font-size:14px;margin:0 0 8px;font-weight:600}.tenue{color:var(--tenue)}
button{background:var(--panel);color:var(--texto);border:1px solid var(--pared);padding:6px 9px;margin:0 4px 4px 0;font:inherit;cursor:pointer}
button.on{border-color:var(--texto)}#grilla{display:grid;grid-template-columns:repeat(8,1fr);gap:2px;margin:8px 0;aspect-ratio:1}
#grilla div{background:var(--panel);cursor:pointer;position:relative}#grilla div.sel{outline:2px solid var(--texto)}
.ejes{display:flex;justify-content:space-between;font-size:11px}#info{white-space:pre;margin-top:8px}
</style></head><body><main>
<canvas id="c" width="640" height="640"></canvas>
<aside><h1>Zombis neuronales</h1>
<div><button id="bMezcla" class="on">mezcla de especies</button><button id="bVanilla">vanilla (PZ hoy)</button><button id="bRegla">regla de la tutora</button></div>
<div class="tenue">campeon de cada estrategia (infeccion en 144 barrios nuevos)</div><div id="camps"></div>
<div id="niveles"><span class="tenue">nivel (sobrevivientes): </span></div>
<div><button id="bBarrio">otro barrio</button><button id="bVel">x4</button><button id="bPausa">pausa</button></div>
<div class="tenue">especies (clic = soltar esa sola)</div>
<div id="grilla"></div><div class="ejes tenue"><span>&larr; callados</span><span>gimen &rarr;</span></div>
<div class="tenue" style="font-size:11px">abajo = pacientes (acechan) · arriba = cargan · brillo = mejor cazador (infecta mas)</div>
<div id="info"></div>
<div class="tenue" style="margin-top:8px;font-size:11px">blanco = sobreviviente (verde = vida, rojo = chance de infectado, arco = golpe del arma)<br>color = especie · hueco = en el piso · tenue = tambalea · aro rojo = mordiendo<br>linea = te esta viendo · anillos: rojo gemido, naranja golpes a puertas, gris pasos/tiros</div>
</aside></main>
<script>
${limpiar('red.js')}
${limpiar('mundo.js')}
const REGLAS = (() => { ${limpiar('tutor/reglas.js')}; return REGLAS; })();
const ARCH = ${arch};
const CAMP = ${camp};
const celdas = Object.entries(ARCH.celdas).map(([k, e]) => { const [i, j] = k.split(',').map(Number); return {i, j, ...e}; });
const maxApt = Math.max(1, ...celdas.map(e => e.apt));
const tono = e => 'hsl(' + Math.round((e.i * 8 + e.j) * 360 / 64 * 2.7) % 360 + ',70%,60%)';
let nivel = 1; const BASE_REGLA = (REGLAS.find(r => r.nombre === (CAMP.base && CAMP.base.nombre)) || {}).politica || null;
const OPC = (conBase = true) => ({nh: nivel, nz: 8, cerca: true, duracion: 45, base: conBase ? BASE_REGLA : null});
let modo = 'mezcla', sel = null, semilla = 1 + Math.floor(Math.random() * 1e6), vel = 4, pausa = false, ep, colores;
function empezar() {
  let gen = null; colores = null;
  if (modo === 'mezcla' && celdas.length) { const top = [...celdas].filter(e => (e.n || 1) >= 3).sort((a, b) => b.apt - a.apt).slice(0, 12); if (!top.length) top.push(...[...celdas].sort((a, b) => b.apt - a.apt).slice(0, 12)); gen = top.map(e => Float32Array.from(e.pesos)); colores = top.map(tono); }
  if (modo === 'una' && sel) { gen = Float32Array.from(sel.pesos); colores = [tono(sel)]; }
  if (modo === 'camp' && sel) { gen = Float32Array.from(sel.pesos); colores = [document.querySelector('#camps button.on')?.style.color || '#e8b04a']; }
  if (modo === 'regla') gen = null;
  ep = crearEpisodio(semilla, gen, OPC(modo !== 'vanilla'));
}
const grilla = document.getElementById('grilla');
for (let j = 7; j >= 0; j--) for (let i = 0; i < 8; i++) { const d = document.createElement('div'), e = celdas.find(c => c.i === i && c.j === j);
  if (e) { d.style.background = tono(e); d.style.opacity = 0.25 + 0.75 * e.apt / maxApt; d.title = 'infeccion esperada ' + e.apt.toFixed(3) + ' · muertes ' + e.muertes.toFixed(2) + ' · pruebas ' + (e.n || 1) + ' · gen ' + e.gen;
    d.onclick = () => { sel = e; modo = 'una'; marcar(); [...grilla.children].forEach(x => x.classList.remove('sel')); d.classList.add('sel'); empezar(); }; }
  grilla.appendChild(d); }

const camps = document.getElementById('camps'), CCOL = ['#e8b04a', '#5ab0e8', '#c46be8', '#6be88f'];
Object.entries(CAMP).filter(([k, c]) => k !== 'vanilla' && k !== 'base' && c.pesos).forEach(([k, c], n) => { const b = document.createElement('button');
  const v = CAMP.vanilla ? CAMP.vanilla.apt : 0; b.textContent = k + ' ' + c.apt.toFixed(3) + (v ? ' (' + (c.apt >= v ? '+' : '') + ((c.apt / v - 1) * 100).toFixed(0) + '%)' : ''); b.style.color = CCOL[n % 4];
  b.onclick = () => { sel = {pesos: c.pesos}; modo = 'camp'; marcar(); [...camps.children].forEach(x => x.classList.remove('on')); b.classList.add('on'); colores = null; ep = crearEpisodio(semilla, Float32Array.from(c.pesos), OPC()); colores = [CCOL[n % 4]]; modoNombre = k; };
  camps.appendChild(b); });
if (CAMP.vanilla) { const d = document.createElement('div'); d.className = 'tenue'; d.style.fontSize = '11px'; d.textContent = 'vanilla en esos barrios: ' + CAMP.vanilla.apt.toFixed(3); camps.appendChild(d); }
let modoNombre = '';
const niv = document.getElementById('niveles'); for (let n = 1; n <= 4; n++) { const b = document.createElement('button'); b.textContent = n; if (n === 1) b.classList.add('on');
  b.onclick = () => { nivel = n; [...niv.querySelectorAll('button')].forEach(x => x.classList.toggle('on', x === b)); empezar(); }; niv.appendChild(b); }
const marcar = () => { if (modo !== 'camp') [...camps.children].forEach(x => x.classList && x.classList.remove('on')); bMezcla.classList.toggle('on', modo === 'mezcla'); bVanilla.classList.toggle('on', modo === 'vanilla'); bRegla.classList.toggle('on', modo === 'regla'); };
bMezcla.onclick = () => { modo = 'mezcla'; marcar(); empezar(); }; bRegla.onclick = () => { modo = 'regla'; marcar(); empezar(); }; bVanilla.onclick = () => { modo = 'vanilla'; marcar(); empezar(); };
bBarrio.onclick = () => { semilla = 1 + Math.floor(Math.random() * 1e6); empezar(); };
bVel.onclick = () => { vel = vel === 1 ? 4 : vel === 4 ? 16 : 1; bVel.textContent = 'x' + vel; };
bPausa.onclick = () => { pausa = !pausa; bPausa.textContent = pausa ? 'seguir' : 'pausa'; };
const cv = document.getElementById('c'), g = cv.getContext('2d'), E = 10, css = n => getComputedStyle(document.documentElement).getPropertyValue(n);
function dibujar() {
  const m = ep.m;
  for (let j = 0; j < LADO; j++) for (let i = 0; i < LADO; i++) { const k = j * LADO + i, t = m.t[k];
    g.fillStyle = t === PARED ? css('--pared') : t === INTERIOR ? css('--interior') : t === PUERTA ? (m.hp[k] <= 0 ? css('--rota') : m.abierta[k] ? css('--interior') : css('--puerta')) : t === VENTANA ? (m.hp[k] <= 0 ? css('--rota') : css('--ventana')) : css('--suelo');
    g.fillRect(i * E, j * E, E, E); }
  if (ep.clima.oscuridad > 0.5) { g.fillStyle = 'rgba(0,0,10,' + (ep.clima.oscuridad - 0.4) * 0.6 + ')'; g.fillRect(0, 0, cv.width, cv.height); }
  for (const s of ep.sonidos) { const a = (ep.t - s.t) / 1.5; g.strokeStyle = s.tipo === -1 ? 'rgba(230,60,50,' : s.tipo === 2 ? 'rgba(230,150,40,' : 'rgba(200,200,190,'; g.strokeStyle += (1 - a) * 0.6 + ')';
    g.beginPath(); g.arc(s.x * E, s.y * E, Math.max(1, s.r * E * Math.min(1, a * 2 + 0.1)), 0, 6.283); g.stroke(); }
  ep.zombis.forEach((z, n) => { if (!z.vivo) { g.fillStyle = '#333'; g.fillRect(z.x * E - 2, z.y * E - 2, 4, 4); return; }
    if (z.ve >= 0) { const h = ep.humanos[z.ve]; g.strokeStyle = 'rgba(255,80,60,.35)'; g.beginPath(); g.moveTo(z.x * E, z.y * E); g.lineTo(h.x * E, h.y * E); g.stroke(); }
    g.fillStyle = colores ? colores[z.especie % colores.length] : '#7fa35a'; g.beginPath(); g.arc(z.x * E, z.y * E, 3.5, 0, 6.283);
    if (z.piso > 0) { g.strokeStyle = g.fillStyle; g.stroke(); } else { g.globalAlpha = z.tambaleo > 0 ? 0.4 : 1; g.fill(); g.globalAlpha = 1; }
    if (z.amago > 0) { g.strokeStyle = '#ff3b2f'; g.lineWidth = 2; g.beginPath(); g.arc(z.x * E, z.y * E, 6, 0, 6.283); g.stroke(); g.lineWidth = 1; }
    g.strokeStyle = g.fillStyle; g.beginPath(); g.moveTo(z.x * E, z.y * E); g.lineTo((z.x + Math.cos(z.a) * 0.8) * E, (z.y + Math.sin(z.a) * 0.8) * E); g.stroke(); });
  for (const h of ep.humanos) { if (!h.vivo) { g.fillStyle = '#7a2a22'; g.fillRect(h.x * E - 3, h.y * E - 3, 6, 6); continue; }
    g.fillStyle = css('--humano'); g.beginPath(); g.arc(h.x * E, h.y * E, 4, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(120,220,120,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(h.x * E, h.y * E, 7, -1.57, -1.57 + 6.283 * Math.max(0, h.vida) / 100); g.stroke();
    if (h.sano < 1) { g.strokeStyle = 'rgba(255,60,40,.95)'; g.beginPath(); g.arc(h.x * E, h.y * E, 10, -1.57, -1.57 + 6.283 * (1 - h.sano)); g.stroke(); }
    if (h.golpe > 0) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(h.x * E, h.y * E, h.arma.alcance * E, h.a - 0.9, h.a + 0.9); g.stroke(); }
    g.lineWidth = 1; }
  const vz = ep.zombis.filter(z => z.vivo).length;
  info.textContent = (modo === 'vanilla' ? 'VANILLA' : modo === 'regla' ? 'REGLA DE LA TUTORA (' + (CAMP.base ? CAMP.base.nombre : '-') + ')' : modo === 'una' ? 'UNA ESPECIE' : modo === 'camp' ? 'CAMPEON ' + modoNombre : 'MEZCLA (12 mejores)') + '\\n' +
    't ' + ep.t.toFixed(0) + ' / ' + DURACION + ' s   barrio ' + semilla + '\\n' + 'heridas ' + ep.heridas + '  mordidas ' + ep.mordidas + '  arrastres ' + ep.arrastres + '   zombis muertos ' + ep.zombisMuertos + '\\n' +
    'zombis en pie ' + vz + '/' + ep.zombis.length + '\\n' + 'noche ' + (ep.clima.oscuridad * 100).toFixed(0) + '%  niebla ' + (ep.clima.niebla * 100).toFixed(0) + '%  lluvia ' + (ep.clima.lluvia * 100).toFixed(0) + '%\\n' +
    ep.humanos.map(h => h.caracter + ' · ' + h.arma.nombre + (h.vivo ? ' · vida ' + h.vida.toFixed(0) + ' · ' + h.modo : ' · MUERTO' + (h.arrastrado ? ' (arrastrado)' : '')) + ' · infectado ' + ((1 - h.sano) * 100).toFixed(0) + '%').join('\\n') +
    (ARCH.vanilla ? '\\n\\nentrenado gen ' + ARCH.gen + ' · ' + celdas.length + ' especies' : '\\n\\n(sin entrenar todavia)');
}
let acu = 0, antes = performance.now();
function cuadro(ahora) { acu += Math.min(0.25, (ahora - antes) / 1000) * vel; antes = ahora;
  if (!pausa) while (acu >= DT) { acu -= DT; paso(ep); if (ep.fin) { ep.espera = (ep.espera || 0) + DT; if (ep.espera > 2) { semilla++; empezar(); } } }   /* (al terminar, 2 s quieto para ver como quedo) */
  dibujar(); requestAnimationFrame(cuadro); }
empezar(); requestAnimationFrame(cuadro);
</script></body></html>`;
fs.writeFileSync(path.join(aqui, 'visor.html'), html); console.log('visor.html', (html.length / 1024).toFixed(0) + ' KB');
