// RED RECURRENTE GENERICA (la misma cuenta que red.js, con medidas a eleccion): h = tanh(Wx x + Wh h + b); salen giro,
// velocidad y una accion (la de mayor valor). Pesos en un vector plano: [Wx, Wh, b, Wo, bo].
export const OCULTAS = 24;
export const nPesos = (nEnt, nAcc) => nEnt * OCULTAS + OCULTAS * OCULTAS + OCULTAS + OCULTAS * (2 + nAcc) + (2 + nAcc);
export function crearRed(w, nEnt, nAcc) {
  const nSal = 2 + nAcc, h = new Float32Array(OCULTAS), h2 = new Float32Array(OCULTAS), o = new Float32Array(nSal);
  const iWh = nEnt * OCULTAS, iB = iWh + OCULTAS * OCULTAS, iWo = iB + OCULTAS, iBo = iWo + OCULTAS * nSal;
  return {
    reiniciar() { h.fill(0); },
    paso(x) {
      for (let j = 0; j < OCULTAS; j++) { let s = w[iB + j]; const fx = j * nEnt, fh = iWh + j * OCULTAS;
        for (let i = 0; i < nEnt; i++) s += w[fx + i] * x[i];
        for (let i = 0; i < OCULTAS; i++) s += w[fh + i] * h[i];
        h2[j] = Math.tanh(s); }
      h.set(h2);
      for (let k = 0; k < nSal; k++) { let s = w[iBo + k]; const f = iWo + k * OCULTAS; for (let j = 0; j < OCULTAS; j++) s += w[f + j] * h[j]; o[k] = s; }
      let a = 0; for (let k = 1; k < nAcc; k++) if (o[2 + k] > o[2 + a]) a = k;
      return {giro: Math.tanh(o[0]), vel: 1 / (1 + Math.exp(-o[1])), accion: a, o};
    }
  };
}
