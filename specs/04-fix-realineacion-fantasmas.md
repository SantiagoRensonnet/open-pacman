# SPEC 04 — Fix: realineación de fantasmas tras cambios de velocidad

> **Estado:** Implemented
> **Depende de:** SPEC 01, SPEC 02, SPEC 03
> **Fecha:** 2026-10-01
> **Objetivo:** Corregir que los fantasmas desaparezcan para siempre tras ser comidos o al terminar el modo frightened, enganchando los cambios de velocidad a la retícula de alineación.

## Por qué existe esta spec

Un fantasma puede desaparecer de la pantalla permanentemente y no volver jamás. La causa raíz combina dos decisiones existentes:

1. Todas las decisiones de movimiento de un fantasma (girar, comprobar muros, entrar a la casa y revivir) solo se ejecutan cuando sus coordenadas están **alineadas** con la retícula de celdas (`aligned()` en `moveGhost`, tolerancia 1e-3 sobre celdas enteras).
2. SPEC 03 introdujo **cambios de velocidad a mitad de celda**: normal 0.1 ↔ frightened 0.05 ↔ ojos 0.2.

Si la velocidad cambia cuando el fantasma está en un offset fraccionario que la nueva velocidad **nunca puede sumar de vuelta a un entero**, el fantasma deja de realinearse para siempre: nunca vuelve a girar, nunca comprueba muros y nunca revive. Se desliza en línea recta atravesando paredes hasta salir del canvas (u orbita la fila del túnel por el wrap). Sigue simulándose pero es invisible.

Los offsets problemáticos son los **múltiplos impares de 0.05** (posiciones reales de los fantasmas frightened, que se mueven a 0.05): con paso 0.1 (fin de frightened) la fracción `.05 → .15 → .25 → …` nunca toca un entero; con paso 0.2 (ojos tras ser comido) solo sobreviven los offsets `{0, .2, .4, .6, .8}`. Reproducido en simulación: ojos desde `x = 13.35` terminan en `x = -386` sin realinear; desde `x = 13.4` vuelven a casa y reviven.

Hay **dos disparadores** del mismo bug, ambos a mitad de celda: el fantasma es comido (modo → `'eyes'`, velocidad 0.2) y el frightened expira (velocidad 0.05 → 0.1). La probabilidad por disparador es ~50% por fantasma, así que tras un par de pellets perder varios fantasmas es lo esperado.

## Alcance

**Dentro:**

- En `moveGhost` (`src/js/game.js`), recalcular `g.speed` según el estado del fantasma **solo dentro del bloque alineado**, y mover con `g.speed`. El cambio de velocidad se aplica en la próxima celda alineada, garantizando que toda velocidad nueva arranca desde una celda entera y siempre puede volver a realinearse.
- `resetPositions` (`src/js/game.js`): añadir `g.speed = GHOST_SPEED` para restaurar el estado tras perder una vida.
- Documentar en las Decisiones de esta spec que la nota de SPEC 03 ("g.speed no se muta") queda superada. SPEC 03 **no se edita** (registro histórico).

**Fuera de alcance (para specs futuras):**

- Cambiar los valores de velocidad (0.05 / 0.1 / 0.2 se mantienen).
- Cambiar el modelo de alineación (`aligned()` y su tolerancia).
- Rediseñar el movimiento a pasos de celda discretos.
- Añadir infraestructura de tests (el repo no tiene; la verificación es manual y con harness ad-hoc).

## Modelo de datos

No hay estructuras nuevas. Cambia el **significado** del campo ya existente `game.ghosts[i].speed`:

- Hoy es un valor fijo que no se usa (la velocidad efectiva se calcula en cada frame). Con este fix pasa a ser la **velocidad efectiva enganchada**: solo se recalcula en celdas alineadas y se usa para mover.
- `createGame()` ya lo inicializa a `GHOST_SPEED` (sin cambios).

Snippet del latch en `moveGhost`:

```js
if ( aligned( g.x ) && aligned( g.y ) ) {
  g.x = Math.round( g.x );
  g.y = Math.round( g.y );
  // Enganchar la velocidad al estado solo en celda alineada: cambiar de
  // velocidad a mitad de celda deja al fantasma en offsets que la nueva
  // velocidad nunca realinea (se perdia atravesando paredes).
  g.speed = g.mode === 'eyes' ? EYES_SPEED :
            game.frightened > 0 && g.mode === 'normal' ? FRIGHTENED_SPEED : GHOST_SPEED;
  decideGhost( game, g );
  if ( !canMove( grid, g.x, g.y, g.dir, actor ) ) return;
}

const d = DIRS[ g.dir ];
g.x += d.x * g.speed;
g.y += d.y * g.speed;
```

## Plan de implementación

1. `src/js/game.js` (`moveGhost`): aplicar el latch del modelo de datos y usar `g.speed` para mover. Prueba manual/harness: comer un fantasma a mitad de celda → sus ojos vuelven a la casa y reviven; que el frightened expire a mitad de celda → todos los fantasmas siguen cazando.
2. `src/js/game.js` (`resetPositions`): añadir `g.speed = GHOST_SPEED`. Prueba manual: al perder una vida, los fantasmas vuelven dentro y salen a su velocidad normal.

## Criterios de aceptación

- [ ] El juego carga sin errores en la consola.
- [ ] Un fantasma comido en un offset impar de 0.05 (p. ej. `x = 13.35`) se convierte en ojos, vuelve a la casa por la puerta y revive en modo normal.
- [ ] Un fantasma comido en cualquier otra posición (incluida celda entera) se comporta igual que antes de este fix.
- [ ] Al terminar el frightened con fantasmas a mitad de celda en offset impar de 0.05, ningún fantasma queda varado: todos se realinean y siguen persiguiendo con su personalidad.
- [ ] El retraso del cambio de velocidad es imperceptible (se aplica en la próxima celda, máximo 19 frames a 0.05).
- [ ] SPEC 01 se mantiene: los 4 fantasmas conservan sus personalidades y colores.
- [ ] SPEC 02 se mantiene: salida escalonada, puerta unidireccional y `resetPositions` intactos.
- [ ] SPEC 03 se mantiene: colores/parpadeo frightened, cadena 200/400/800/1600, ojos que atraviesan la puerta desde fuera, revivir en modo normal aunque quede frightened.
- [ ] El contrato de globals entre archivos no cambia (sigue siendo `createGame` / `update` / `DIRS`).
- [ ] La nota de SPEC 03 "g.speed no se muta" queda registrada como superada en las Decisiones de esta spec, sin editar SPEC 03.

## Decisiones

- **Sí:** enganchar los cambios de velocidad a la retícula (latch en `g.speed`). Un solo mecanismo cubre todos los cambios de velocidad actuales y futuros; sin saltos visuales; ~5 líneas en `game.js`.
- **No:** redondear (snap) la posición en las transiciones. Diff más pequeño, pero produce un salto visible al comer (hasta ~9 px) y es frágil: cualquier velocidad futura reintroduce la trampa.
- **No:** elegir velocidades "compatibles" por aritmética modular (p. ej. ojos a 0.15). Frágil y difícil de explicar; depende de que ningún valor futuro rompa la propiedad.
- **No:** mover las decisiones fuera del gate de `aligned()`. Haría elegir dirección desde posiciones fraccionarias con `Math.round`, causando jitter en la frontera de celda.
- **Sí:** `g.speed` pasa a ser mutable y enganchado. Supera la nota de SPEC 03 ("g.speed no se muta"), que se documenta aquí y **no se edita** en su archivo: los specs son el registro histórico y la decisión era correcta en su momento.
- **Sí:** retrasar el efecto de la velocidad hasta la próxima celda alineada (máximo 19 frames ≈ 0.3 s). Es imperceptible y seguro: continuar en la dirección actual hasta la próxima celda siempre es legal, porque esa dirección se eligió con `canMove` en la celda anterior.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El retraso del cambio de velocidad (hasta 19 frames) altera ligeramente el ritmo de ojos/frightened | Máximo ~0.3 s en un solo fantasma y solo cuando el cambio cae a mitad de celda; el arcade también cambia de velocidad en fronteras de celda. |
| Un fantasma comido a mitad de celda "flota" un instante a 0.05 antes de acelerar como ojos | Es el mismo retraso del latch; los ojos ya son invulnerables en ese tramo (modo `eyes` se aplica al instante en `update`). |
| Verificación depende de un harness ad-hoc que no queda en el repo | Los escenarios quedan descritos en los criterios de aceptación y se comprueban a mano en el navegador; el harness solo es una ayuda de diagnóstico. |

## Qué **no** entra en esta spec

- Cambiar velocidades o el modelo de alineación.
- Movimiento por pasos de celda discretos.
- Infraestructura de tests automatizados.
- Cualquier ajuste de jugabilidad de SPEC 01/02/03.

Cada uno de esos puntos, si llega, va en su propia spec.