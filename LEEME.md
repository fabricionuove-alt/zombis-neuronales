# Zombis neuronales

Zombis de Project Zomboid que cazan con una red neuronal entrenada por evolución, sobre un simulador sin gráficos
que copia las reglas del juego (`REGLAS-PZ.md`).

## Entrenar en la nube (GitHub Actions, gratis en repos públicos)

1. Crear un repo **público** vacío en github.com (sin README).
2. En esta carpeta:
   ```
   git remote add origin https://github.com/USUARIO/zombis-neuronales.git
   git push -u origin main
   ```
3. En el repo: pestaña **Actions** → **entrenar** → **Run workflow** (minutos por isla, cantidad de islas).
4. Al terminar, el mejor cerebro queda en `campeones.json` (un commit automático). Bajarlo con `git pull` y pasarlo
   al mod con `node exportar-mod.mjs Genetico` (o la estrategia que haya ganado).

## Archivos

- `mundo.js`: el simulador. `red.js`: la red. `torneo.mjs`: cuatro estrategias evolutivas compitiendo.
- `tutor/reglas.js` y `tutor.mjs`: los especímenes de la tutora (reglas a mano) y su prueba contra el vanilla.
- `juntar.mjs`: junta las islas de la nube. `exportar-mod.mjs`: pasa el campeón al mod de PZ.
- `armar-visor.mjs` → `visor.html`: los puntitos.
