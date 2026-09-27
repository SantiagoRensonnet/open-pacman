// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Bounding box de la casa: cols 11-16, filas 12-15 (la fila 12 incluye la puerta).
const GHOST_HOUSE = { x1: 11, y1: 12, x2: 16, y2: 15 };

// Celda justo encima de la puerta; objetivo de cualquier fantasma dentro.
const GHOST_EXIT = { x: 13, y: 11 };

// Frames que espera cada fantasma antes de salir (indice alineado con GHOST_STARTS).
const GHOST_EXIT_DELAYS = [ 0, 60, 120, 180 ];

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g, i ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      exitDelay: GHOST_EXIT_DELAYS[ i ],
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost dentro de la casa: bloqueado solo por pared (1)
//   ghost fuera de la casa: bloqueado por pared (1) y puerta (3)
function isWall( grid, x, y, actor, ghostInside ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && ( actor === 'pacman' || !ghostInside ) ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  // Puerta unidireccional: los fantasmas fuera de la casa la tratan como muro.
  const ghostInside = actor !== 'pacman' && isInGhostHouse( Math.round( x ), Math.round( y ) );
  return !isWall( grid, tx, ty, actor, ghostInside );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// True si la celda (x,y) esta dentro de la casa de los fantasmas.
function isInGhostHouse( x, y ) {
  return x >= GHOST_HOUSE.x1 && x <= GHOST_HOUSE.x2 &&
         y >= GHOST_HOUSE.y1 && y <= GHOST_HOUSE.y2;
}

// Objetivo (celda) de un fantasma segun su personalidad.
// Devuelve { x, y }; puede caer sobre pared o fuera del laberinto, solo se usa
// para comparar distancias.
function ghostTarget( game, g ) {
  // Dentro de la casa: salir por la puerta, ignorando la personalidad.
  if ( isInGhostHouse( Math.round( g.x ), Math.round( g.y ) ) ) {
    return GHOST_EXIT;
  }

  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const pd = DIRS[ p.dir ] || { x: 0, y: 0 };

  if ( g.kind === 'hunter' ) {
    return { x: px, y: py };
  }
  if ( g.kind === 'ambusher' ) {
    // Apunta 4 celdas delante de Pac-Man.
    return { x: px + pd.x * 4, y: py + pd.y * 4 };
  }
  if ( g.kind === 'flanker' ) {
    // Efecto pinza: V = celda de Pac-Man + 2·dir; objetivo = 2·V − celda hunter.
    const hunter = game.ghosts.find( ( gh ) => gh.kind === 'hunter' );
    if ( !hunter ) return { x: px, y: py };
    const vx = px + pd.x * 2;
    const vy = py + pd.y * 2;
    return { x: vx * 2 - hunter.x, y: vy * 2 - hunter.y };
  }
  if ( g.kind === 'coward' ) {
    // Cobarde: si esta a menos de 8 celdas (Manhattan) de Pac-Man, huye a su
    // esquina inferior-izquierda; si no, lo persigue.
    const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
    if ( dist < 8 ) return { x: 1, y: 29 };
    return { x: px, y: py };
  }
  return { x: px, y: py };
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const target = ghostTarget( game, g );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  if ( target ) {
    let best = choices[ 0 ];
    let bestDist = Infinity;
    for ( const dir of choices ) {
      const d = DIRS[ dir ];
      const nx = g.x + d.x;
      const ny = g.y + d.y;
      const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
      if ( dist < bestDist ) {
        bestDist = dist;
        best = dir;
      }
    }
    g.dir = best;
  }
}

function moveGhost( game, g ) {
  if ( g.exitDelay > 0 ) return;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.exitDelay = GHOST_EXIT_DELAYS[ i ];
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => {
    if ( g.exitDelay > 0 ) g.exitDelay--;
    moveGhost( game, g );
  } );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
