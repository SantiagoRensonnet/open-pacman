# SPEC 02 — Salida fiable y escalonada de la casa de los fantasmas

> **Estado:** Implemented
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-27
> **Objetivo:** Garantizar que los 4 fantasmas salgan siempre de la casa al inicio de la partida (hoy solo salen si Pac-Man pasa cerca), con salida escalonada por tiempo y puerta unidireccional.

## Por qué existe esta spec

`ghostTarget` (SPEC 01) apunta siempre a objetivos ligados a Pac-Man, que aparece por debajo de la casa. Salir por la puerta (fila 12) implica alejarse del objetivo, así que la elección voraz por distancia Manhattan nunca escoge subir: los fantasmas rebotan dentro hasta que Pac-Man se acerca. No existe ninguna lógica de "salir de la casa".

## Alcance

**Dentro:**

- Detección geométrica de "dentro de la casa" (bounding box) en `src/js/game.js`, sin estado de dentro/fuera por fantasma.
- Fantasmas dentro de la casa: su objetivo pasa a ser la celda de salida sobre la puerta, ignorando su personalidad.
- Puerta unidireccional: un fantasma fuera de la casa trata la puerta (tile 3) como muro; dentro la atraviesa libremente. Pac-Man sigue bloqueado siempre.
- Salida escalonada por tiempo: `GHOST_EXIT_DELAYS = [ 0, 60, 120, 180 ]` frames (0/1/2/3 s a 60 fps), en el orden de `GHOST_STARTS` (hunter, ambusher, flanker, coward). Cuenta atrás por fantasma (`exitDelay`) que solo avanza en estado `playing`.
- Fantasmas no liberados: quietos en su celda de inicio (sin movimiento ni bobbing).
- `resetPositions` reinicia las cuentas atrás: tras perder una vida los fantasmas vuelven dentro y el escalonado se repite.

**Fuera de alcance (para specs futuras):**

- Salida escalonada por dots comidos (esquema del arcade).
- Bobbing (rebote arriba/abajo) de los fantasmas mientras esperan.
- Hunter empezando fuera de la casa (como Blinky en el arcade).
- Olas scatter/chase, power pellets, velocidades por fantasma (ya diferidos en SPEC 01).

## Modelo de datos

Constantes nuevas, locales a `src/js/game.js` (no se exponen en `window`; el contrato de globals entre archivos no cambia):

```js
// Frames que espera cada fantasma antes de salir (indice alineado con GHOST_STARTS).
const GHOST_EXIT_DELAYS = [ 0, 60, 120, 180 ];

// Bounding box de la casa: cols 11-16, filas 12-15 (la fila 12 incluye la puerta).
const GHOST_HOUSE = { x1: 11, y1: 12, x2: 16, y2: 15 };

// Celda justo encima de la puerta; objetivo de cualquier fantasma dentro.
const GHOST_EXIT = { x: 13, y: 11 };
```

Cada fantasma (`game.ghosts[i]`) gana un campo mutable:

```js
{ x, y, dir, speed, kind, exitDelay }
```

- `exitDelay`: frames restantes antes de poder moverse. Se inicializa desde `GHOST_EXIT_DELAYS[i]` en `createGame()` y se restaura en `resetPositions()`. Se decrementa una vez por frame en `update()` sin bajar de 0.

Convenciones:

- "Dentro de la casa" = celda dentro de `GHOST_HOUSE` (incluye las celdas de puerta, fila 12). La comprobación usa celda entera (`Math.round`), como el resto del código.
- El túnel (fila 14) nunca colisiona con la bounding box: las paredes de las cols 10 y 17 separan el interior del túnel.
- El orden de salida es el orden de `GHOST_STARTS`: hunter → ambusher → flanker → coward.

## Plan de implementación

1. `src/js/game.js`: añadir `GHOST_HOUSE`, `GHOST_EXIT` y `isInGhostHouse( x, y )` (true si la celda está dentro del bounding box). En `ghostTarget()`, si el fantasma está dentro, devolver `GHOST_EXIT` antes que cualquier personalidad. Prueba manual: los 4 fantasmas salen de la casa al instante, todos a la vez.
2. `src/js/game.js`: puerta unidireccional. Donde se evalúa el movimiento de un fantasma (`canMove`/`isWall`), el tile 3 se trata como muro si el fantasma NO está dentro de la casa; Pac-Man sigue bloqueado siempre. Prueba manual: con Pac-Man quieto bajo la casa, ningún fantasma vuelve a entrar por la puerta una vez fuera.
3. `src/js/game.js`: añadir `GHOST_EXIT_DELAYS` y el campo `exitDelay` en `createGame()`. En `update()`, decrementar `exitDelay` de cada fantasma (sin bajar de 0); en `moveGhost()`, si `exitDelay > 0` el fantasma no se mueve. Prueba manual: hunter sale al instante, ambusher ~1 s, flanker ~2 s, coward ~3 s.
4. `src/js/game.js`: `resetPositions()` restaura `exitDelay` desde `GHOST_EXIT_DELAYS[i]`. Prueba manual: al perder una vida, los fantasmas vuelven dentro y el escalonado se repite.

## Criterios de aceptación

- [ ] El juego carga sin errores en la consola.
- [ ] Con Pac-Man quieto en su celda de inicio, el hunter sale de la casa inmediatamente.
- [ ] Con Pac-Man quieto, ambusher, flanker y coward salen aproximadamente a 1 s, 2 s y 3 s del inicio respectivamente.
- [ ] Los 4 fantasmas están fuera de la casa antes de ~5 s de partida, independientemente de la posición de Pac-Man.
- [ ] Ningún fantasma que ya está fuera vuelve a entrar en la casa por la puerta (probado con Pac-Man quieto bajo la casa).
- [ ] Los fantasmas no liberados permanecen quietos en su celda hasta que les toca salir.
- [ ] Pac-Man sigue sin poder atravesar la puerta.
- [ ] Al perder una vida, los 4 fantasmas vuelven dentro y el escalonado se repite (hunter inmediato, coward ~3 s).
- [ ] Fuera de la casa, las personalidades de SPEC 01 se mantienen (hunter persigue, ambusher adelanta, flanker pinza, coward huye cerca).
- [ ] Comer todos los dots sigue mostrando la pantalla de victoria.

## Decisiones

- **Sí:** arreglar la salida y añadir el escalonado en la misma spec. SPEC 01 difería el escalonado asumiendo que los 4 ya salían a la vez; al no ser cierto (bug), el escalonado entra aquí.
- **Sí:** escalonado por tiempo (0/1/2/3 s), no por dots. El bug original era el acoplamiento de la salida a lo que hace Pac-Man; el esquema por dots mantiene ese acoplamiento (si Pac-Man no come, no salen).
- **Sí:** detección geométrica sin estado (`isInGhostHouse` por bounding box). `resetPositions` funciona sin estructura extra y es auto-curativa: cualquier fantasma que acabe dentro por el motivo que sea volverá a salir.
- **No:** flag `inHouse` por fantasma. Estado extra que mantener y resetear; la geometría distingue dentro/fuera sin ambigüedad (el túnel está separado por paredes).
- **Sí:** puerta unidireccional para fantasmas. Sin ella, un fantasma persiguiendo a Pac-Man por la fila 11 se volvería a colar por la puerta y el bug reaparecería.
- **Sí:** fantasmas en espera quietos en su celda. Cero lógica de movimiento extra; Pac-Man no puede alcanzarlos (la puerta le bloquea), así que no hay colisiones que gestionar.
- **No:** bobbing del arcade mientras esperan. Cosmético; añade movimiento para fantasmas no liberados sin aportar jugabilidad.
- **No:** hunter fuera de la casa al inicio (Blinky del arcade). SPEC 01 colocó los 4 dentro; con delay 0 el hunter sale en el primer frame y el efecto es equivalente.
- **Sí:** constantes locales en `game.js`, sin nuevos globals en `window`. El contrato entre archivos (AGENTS.md) no cambia.
- **Sí:** reiniciar el escalonado tras cada vida. Da un respiro tras cada muerte, como el arcade.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Empates de distancia Manhattan dentro de la casa que desvíen a un fantasma lejos de la puerta | El interior es un rectángulo abierto de 6×3 sin obstáculos; con objetivo `GHOST_EXIT` siempre existe un movimiento que reduce la distancia desde cualquier celda interior. |
| La bounding box clasifique mal a un fantasma del túnel (fila 14) | Las paredes en cols 10 y 17 impiden llegar a las cols 11-16 desde el túnel; un fantasma fuera nunca ocupa esas celdas. |
| La cuenta atrás siga corriendo durante overlays/pausa | Se decrementa dentro de `update()`, que solo corre en estado `playing` (verificado en `main.js`). |

## Qué **no** entra en esta spec

- Salida escalonada por dots comidos.
- Bobbing de fantasmas en espera.
- Hunter empezando fuera de la casa.
- Olas scatter/chase, power pellets, velocidades por fantasma.

Cada uno de esos puntos, si llega, va en su propia spec.