# SPEC 03 — Power pellets y modo frightened

> **Estado:** Approved
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-09-27
> **Objetivo:** Añadir los 4 power pellets del arcade en las esquinas del laberinto, que al comerlos activan el modo frightened: los fantasmas se vuelven azules, se mueven al azar y pueden ser comidos.

## Alcance

**Dentro:**

- Nuevo tile power pellet: char `o` → valor 4 en `parseTile` (`src/js/maze.js`); las celdas (1,3), (26,3), (1,23) y (26,23) de `MAZE_STR` pasan de `.` a `o`.
- Comer pellet en `movePacman` (`src/js/game.js`): +50 puntos, decrementa `dotsRemaining` (los pellets cuentan como dots para la victoria) y activa el modo frightened.
- Modo frightened en `src/js/game.js`: duración fija de 420 frames (7 s a 60 fps); los fantasmas asustados eligen dirección al azar en cada intersección y su velocidad baja a 0.05.
- Fantasmas comestibles: colisión Pac-Man↔fantasma asustado lo come (cadena 200/400/800/1600 que se reinicia con cada pellet) y lo convierte en ojos.
- Ojos: viajan a la casa a velocidad 0.2, atraviesan la puerta desde fuera (excepción a la puerta unidireccional de SPEC 02) y reviven al entrar, saliendo en modo normal.
- Parpadeo: los fantasmas asustados alternan a blanco durante los últimos 120 frames (2 s).
- Render en `src/js/render.js`: pellets como dots grandes parpadeantes; fantasmas asustados en azul oscuro; ojos como par de ojos sin cuerpo.
- `resetPositions` limpia el modo frightened (temporizador, cadena y `mode` de cada fantasma) tras perder una vida.

**Fuera de alcance (para specs futuras):**

- Duración de frightened decreciente por nivel (no hay niveles).
- Frutas y bonus items.
- Puntos flotantes en pantalla al comer un fantasma (el marcador basta).
- Sonido y música.
- Olas scatter/chase y velocidades por fantasma (ya diferidos en SPEC 01).

## Modelo de datos

Tile nuevo en `src/js/maze.js`: `'o'` → 4 (power pellet). Celdas: (1,3), (26,3), (1,23), (26,23) — mantienen la simetría del laberinto.

Constantes nuevas, locales a `src/js/game.js` (no se exponen en `window`; el contrato de globals no cambia):

```js
const FRIGHTENED_FRAMES = 420;       // 7 s a 60 fps
const FRIGHTENED_FLASH_FRAMES = 120; // ultimos 2 s: parpadeo a blanco
const FRIGHTENED_SPEED = 0.05;       // mitad de GHOST_SPEED
const EYES_SPEED = 0.2;
const GHOST_CHAIN_SCORES = [ 200, 400, 800, 1600 ];
const GHOST_DOOR = { x: 13, y: 12 }; // celda de la puerta; objetivo de los ojos
```

La partida (`createGame()`) gana dos campos:

```js
{
  // ...campos existentes,
  frightened: 0,  // frames restantes de modo frightened (0 = inactivo)
  ghostChain: 0,  // fantasmas comidos en el frightened actual (indice en GHOST_CHAIN_SCORES)
}
```

Cada fantasma gana un campo mutable:

```js
{ x, y, dir, speed, kind, exitDelay, mode }
```

- `mode`: `'normal' | 'eyes'`. No hay modo frightened por fantasma: es global (`game.frightened > 0`) y solo aplica a fantasmas en modo `'normal'`.
- Los ojos reviven con `mode = 'normal'` y `exitDelay = 0` al entrar en la casa.

Convenciones:

- La velocidad efectiva se calcula en `moveGhost`: eyes → `EYES_SPEED`, frightened → `FRIGHTENED_SPEED`, resto → `GHOST_SPEED`. `g.speed` no se muta.
- El temporizador se decrementa en `update()`, que solo corre en estado `playing` (igual que `exitDelay` en SPEC 02).
- Comer un pellet con frightened activo reinicia `frightened` a 420 y `ghostChain` a 0; los ojos en tránsito no se ven afectados.

## Plan de implementación

1. `src/js/maze.js`: añadir `'o'` → 4 en `parseTile` y cambiar las 4 esquinas de `.` a `o`. `src/js/game.js`: en `createGame()` contar tiles 2 y 4 como comestibles; en `movePacman` comer tile 4 (+50, `dotsRemaining--`). `src/js/render.js`: dibujar tile 4 como dot grande (radio ~5) parpadeante. Prueba manual: se ven los 4 pellets parpadeando, comerlos suma 50 y la victoria los exige.
2. `src/js/game.js`: campos `frightened`/`ghostChain` en `createGame()`; activación al comer pellet; decremento en `update()`; en `decideGhost()`, si frightened y modo normal, elegir dirección al azar entre las opciones válidas; velocidad efectiva en `moveGhost`. `src/js/render.js`: fantasma asustado en azul oscuro con cara clara, alternando a blanco cuando `frightened <= FRIGHTENED_FLASH_FRAMES`. Prueba manual: al comer un pellet los fantasmas se vuelven azules, lentos y erráticos ~7 s y parpadean los últimos ~2 s; la colisión sigue matando a Pac-Man (aún no son comestibles).
3. `src/js/game.js`: en la colisión, si frightened y modo normal → comer fantasma (sumar `GHOST_CHAIN_SCORES[ghostChain]` con tope en el último, `ghostChain++`, `mode = 'eyes'`); los ojos no colisionan con Pac-Man; en `ghostTarget`/`canMove`, los ojos apuntan a la celda de la puerta `GHOST_DOOR` (13,12) y la puerta (tile 3) no es muro para ellos aunque estén fuera; al entrar en la casa (`isInGhostHouse`) reviven con `mode = 'normal'` y `exitDelay = 0`. `src/js/render.js`: dibujar ojos sin cuerpo. Prueba manual: comer un fantasma suma la cadena, sus ojos vuelven rápido, entran por la puerta y el fantasma revivido sale ya en modo normal.
4. `src/js/game.js`: `resetPositions()` pone `frightened = 0`, `ghostChain = 0` y `mode = 'normal'` en los 4 fantasmas. Prueba manual: perder una vida durante frightened devuelve todo a la normalidad y el escalonado de SPEC 02 se repite.

## Criterios de aceptación

- [ ] El juego carga sin errores en la consola.
- [ ] Se ven exactamente 4 power pellets en (1,3), (26,3), (1,23) y (26,23), más grandes que los dots y parpadeando.
- [ ] Comer un pellet suma 50 puntos.
- [ ] Al comer un pellet, los fantasmas fuera de la casa se vuelven azules durante ~7 s y parpadean a blanco los últimos ~2 s.
- [ ] Durante frightened los fantasmas se mueven al azar (no persiguen) y visiblemente más lentos.
- [ ] Comer fantasmas asustados suma 200, 400, 800 y 1600 en ese orden; comer otro pellet reinicia la cadena.
- [ ] Un fantasma comido se convierte en ojos que vuelven a la casa rápidamente, entran por la puerta y reviven.
- [ ] Un fantasma revivido sale de la casa en modo normal (no asustado) aunque quede tiempo de frightened.
- [ ] Los ojos no matan a Pac-Man ni pueden ser comidos.
- [ ] Ningún fantasma en modo normal que esté fuera entra por la puerta (SPEC 02 se mantiene); solo los ojos la atraviesan hacia dentro.
- [ ] Comer un segundo pellet con frightened activo reinicia el temporizador a ~7 s.
- [ ] Al perder una vida durante frightened, el modo termina y los fantasmas vuelven a su estado normal.
- [ ] La pantalla de victoria solo aparece tras comer también los 4 pellets.
- [ ] Fuera de frightened se mantienen las personalidades de SPEC 01 y la salida escalonada de SPEC 02.

## Decisiones

- **Sí:** tile nuevo `'o'` → 4 en `MAZE_STR`. Mantiene la convención de un char por tipo y hace los pellets editables en el string del laberinto; la alternativa (lista de coordenadas aparte) duplicaba fuentes de verdad.
- **Sí:** posiciones arcade (1,3), (26,3), (1,23), (26,23). Coinciden con el nivel 1 original y ya contenían dots, así que no cambia el número de celdas comestibles y se mantiene la simetría.
- **Sí:** los pellets cuentan como dots para la victoria (entran en `dotsRemaining`). Cero lógica extra; fiel al arcade.
- **Sí:** frightened global en la partida (`game.frightened`), no por fantasma. Es un temporizador único en el arcade; los ojos son la única excepción por fantasma (`mode`).
- **Sí:** movimiento aleatorio en intersecciones durante frightened (la rama que SPEC 01 eliminó, reintroducida solo para este modo). Fiel al arcade; `Math.random` sin semilla.
- **Sí:** cadena 200/400/800/1600 que se reinicia con cada pellet. Arcade estándar.
- **Sí:** ojos que vuelven a la casa a 0.2 con objetivo `GHOST_DOOR` (13,12) y reviven al entrar. Reutiliza la navegación voraz existente; exige una excepción a la puerta unidireccional de SPEC 02 (los ojos sí la atraviesan desde fuera).
- **Sí:** objetivo de los ojos en la celda de la puerta, no en su celda de `GHOST_STARTS`. Con la navegación voraz y el desempate actual, apuntar a la celda de inicio hace que los ojos oscilen sobre la fila 11 y den vueltas por el túnel sin entrar; apuntar a la puerta los revive al instante y cumple el criterio "rápidamente". Decisión tomada durante la implementación (paso 3).
- **Sí:** fantasma revivido vuelve en modo normal aunque quede tiempo de frightened. Comportamiento del arcade: el peligro clásico tras comer un fantasma.
- **No:** teletransportar el fantasma comido a la casa. Más simple, pero pierde la lectura visual de los ojos volviendo.
- **Sí:** duración fija de 420 frames con parpadeo los últimos 120. No hay niveles, así que no hay decrecimiento.
- **Sí:** velocidad efectiva calculada en `moveGhost`, sin mutar `g.speed`. Menos estado que restaurar en `resetPositions`.
- **No:** puntos flotantes al comer fantasmas. Cosmético; el marcador basta.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Los ojos, con navegación voraz y regla de no-reverse, se atascan lejos de la casa | La regla de callejón sin salida ya permite el giro de 180; es la misma lógica que guía a los 4 fantasmas hacia Pac-Man desde cualquier celda. |
| Comer un pellet con fantasmas aún en espera (`exitDelay > 0`) | No se mueven hasta salir; al salir, si frightened sigue activo, se mueven al azar como los demás. Pac-Man no puede alcanzarlos dentro (la puerta le bloquea). |
| El azul frightened se confunde con las paredes (#2121ff) | Las paredes son líneas finas y el fantasma una silueta rellena con cara clara; el parpadeo final a blanco refuerza la lectura. |

## Qué **no** entra en esta spec

- Duración de frightened decreciente por nivel.
- Frutas y bonus.
- Puntos flotantes al comer fantasmas.
- Sonido y música.
- Olas scatter/chase y velocidades por fantasma.

Cada uno de esos puntos, si llega, va en su propia spec.