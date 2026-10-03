# Reglas de PZ que usa el simulador

Salen de `zombie.characters.IsoZombie` (B42, leído con `javap -c` de projectzomboid.jar).
**Exacto** = copiado del código. **Calibrado** = la forma está en el código pero el número lo puse yo; se ajusta comparando con el juego.

| Regla | En el juego | En el sim |
|---|---|---|
| Radio de visión | `20 - max(niebla*7, lluvia*2.5 + oscuridad*5)`, limitado a 10..20; ×1.75 vista de águila, ×0.35 vista pobre, ×0.5 si está comiendo | exacto (vista normal) |
| Chance de verte | escalones del cono: producto punto <-0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8 → ÷8, ÷4, … ×8, ×16, ×32; luz de tu casilla; correr ×3; agacharse la baja; cerca de 1.5 casillas sube | misma forma, calibrado (0.15 por segundo de base) |
| Oído | va al sonido con un error de 2 a 10 casillas (5 con lluvia fuerte) | error 2..8 según distancia, +3 con lluvia |
| Abalanzarse | `LungeState`, al tener la presa cerca y de frente | menos de 3 casillas y producto punto >0.7: 0.8 s a ×2.2 |
| Golpes a puertas y ventanas | `tryThump`; el ruido atrae a otros zombis | 1 golpe por segundo, puerta 12, ventana 3, ruido de radio 15 |
| Ataque | más chance si te rodean o te atacan de atrás | 0.4 + 0.15 por zombi pegado, ×1.5 de atrás; 12 de daño |
| Velocidades | shambler, fast shambler, sprinter | shambler 0.8 c/s; humano camina 2.2, corre 3.6, agachado 1.2 (calibrado) |

**Lo nuevo (no existe en PZ):** el zombi puede **gemir**, un sonido de radio 14 que oyen los otros zombis.
En el mod se haría con `addSound`.

**Lo que no está todavía:** zombis que se arrastran, cercas, autos, hacerse el muerto, comer cuerpos, horda migrando y armas de fuego realistas.
