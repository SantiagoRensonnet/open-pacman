# SPEC 01 — Cuatro fantasmas con personalidades clásicas

> **Estado:** Implemented
> **Depende de:** —
> **Fecha:** 2026-09-23
> **Objetivo:** Ampliar el juego de 2 a 4 fantasmas, cada uno con una personalidad clásica del arcade (cazador, emboscador, flanqueador, cobarde) y su color distintivo.

## Alcance

**Dentro:**

- `GHOST_STARTS` pasa de 2 a 4 entradas en `src/js/maze.js`, cada una con su `kind`.
- Refactor de `decideGhost()` en `src/js/game.js` a un modelo de "celda objetivo": cada `kind` calcula un objetivo y el fantasma elige la dirección que minimiza la distancia Manhattan al objetivo.
- Cuatro personalidades: `hunter` (persigue a Pac-Man directamente — el agresivo), `ambusher` (apunta 4 celdas delante de Pac-Man), `flanker` (efecto pinza usando la posición del hunter), `coward` (persigue de lejos y huye a su esquina a menos de 8 celdas).
- Colores clásicos por fantasma en `src/js/render.js`: rojo=hunter, rosa=ambusher, cian=flanker, naranja=coward.

**Fuera de alcance (para specs futuras):**

- Olas scatter/chase (alternancia dispersión/persecución).
- Salida escalonada de la casa de los fantasmas (los 4 salen a la vez, como hoy).
- Velocidades por fantasma (todos comparten `GHOST_SPEED = 0.1`).
- Power pellets y modo frightened (fantasmas comestibles).

## Modelo de datos

`GHOST_STARTS` en `src/js/maze.js`:

```js
const GHOST_STARTS = [
  { x: 12, y: 14, kind: 'hunter' },
  { x: 13, y: 14, kind: 'ambusher' },
  { x: 14, y: 14, kind: 'flanker' },
  { x: 15, y: 14, kind: 'coward' },
];
```

Convenciones:

- Los `kind` se nombran en inglés (convención existente: 'hunter', 'random').
- El objetivo de cada fantasma es una celda `{ x, y }`. Puede caer sobre pared o fuera del laberinto sin problema: solo se usa para comparar distancias.
- Distancias en celdas, Manhattan (`|dx| + |dy|`), consistente con el `hunter` actual.
- Esquina de retiro del `coward`: `(1, 29)` (abajo-izquierda).
- Los fantasmas no colisionan entre sí (comportamiento actual, se mantiene).

## Plan de implementación

1. `src/js/maze.js`: ampliar `GHOST_STARTS` a las 4 entradas del modelo de datos. Con el código actual los `kind` nuevos caen en la rama aleatoria de `decideGhost`, así que el juego sigue funcionando con 4 fantasmas.
2. `src/js/game.js`: refactor de `decideGhost()` al modelo de celda objetivo. Nueva función `ghostTarget( game, g )` que devuelve `{ x, y }` según `kind`; la elección de dirección minimiza la distancia Manhattan al objetivo. Implementar `hunter` (celda de Pac-Man) y `ambusher` (celda de Pac-Man + 4·dir de Pac-Man). Los kinds pendientes (`flanker`, `coward`) mantienen la rama aleatoria provisional.
3. `src/js/game.js`: implementar `flanker` en `ghostTarget`. V = celda de Pac-Man + 2·dir; objetivo = 2·V − celda del hunter (localizado con `game.ghosts.find( ( g ) => g.kind === 'hunter' )`). Si no se encuentra hunter, usar la celda de Pac-Man como objetivo.
4. `src/js/game.js`: implementar `coward` en `ghostTarget`. Si la distancia Manhattan fantasma↔Pac-Man < 8 → objetivo `(1, 29)`; si no → celda de Pac-Man. Eliminar la rama aleatoria (ya no queda ningún `kind` sin objetivo).
5. `src/js/render.js`: reordenar `GHOST_COLORS` a `[ '#ff0000', '#ffb8ff', '#00ffff', '#ffb852' ]` para que el índice de `GHOST_STARTS` produzca el mapeo clásico.

## Criterios de aceptación

- [ ] El juego carga sin errores en la consola.
- [ ] Se ven exactamente 4 fantasmas, cada uno de un color distinto (rojo, rosa, cian, naranja).
- [ ] El fantasma rojo (hunter) reduce su distancia a Pac-Man de forma consistente.
- [ ] El fantasma rosa (ambusher) se posiciona por delante de la trayectoria de Pac-Man, no directamente sobre él.
- [ ] El fantasma cian (flanker) toma rutas distintas del hunter cuando ambos persiguen a Pac-Man (efecto pinza observable).
- [ ] El fantasma naranja (coward) se aleja hacia la esquina inferior izquierda cuando está a menos de 8 celdas de Pac-Man.
- [ ] Los 4 fantasmas atraviesan la puerta de la casa y Pac-Man no.
- [ ] Al perder una vida, los 4 fantasmas y Pac-Man vuelven a sus posiciones iniciales.
- [ ] Comer todos los dots sigue mostrando la pantalla de victoria.

## Decisiones

- **Sí:** conjunto clásico de personalidades (hunter/ambusher/flanker/coward). Fiel al arcade y cada una observablemente distinta.
- **No:** mantener el fantasma `random`. Se pidieron 4 personalidades distintas y el conjunto clásico las cubre; se elimina la rama aleatoria.
- **Sí:** modelo unificado de celda objetivo (todos los fantasmas minimizan distancia a su objetivo). `decideGhost` queda con una sola lógica de elección.
- **No:** olas scatter/chase. Añadirían una máquina de estados global; se difieren a otra spec.
- **No:** salida escalonada de la casa. Mantiene el comportamiento actual sin timers.
- **No:** velocidades por fantasma. La diferenciación viene solo del comportamiento.
- **Sí:** flanqueador clásico con dependencia de la posición del hunter. El hunter siempre existe en `GHOST_STARTS`; la dependencia es segura y hay fallback defensivo.
- **Sí:** distancia Manhattan también para el umbral del `coward` (8 celdas), por consistencia con el código existente, aunque el arcade usa euclidiana. La diferencia de jugabilidad es despreciable.
- **Sí:** el objetivo puede ser una celda no transitable (p. ej. "4 delante" mirando a una pared). No requiere clamping.
- **Sí:** kinds en inglés y comentarios en español (convención del repo).

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Los 4 fantasmas salen a la vez y se amontonan en la puerta | No hay colisión entre fantasmas (comportamiento actual). Si molesta, la salida escalonada va en otra spec. |
| `flanker` depende de que exista un `hunter` en `game.ghosts` | `GHOST_STARTS` siempre lo incluye; además hay fallback al objetivo de Pac-Man. |

## Qué **no** entra en esta spec

- Olas scatter/chase.
- Salida escalonada de la casa de los fantasmas.
- Power pellets y modo frightened.
- Velocidades por fantasma.
- Progresión de dificultad por niveles.

Cada uno de esos puntos, si llega, va en su propia spec.