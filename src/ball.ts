/**
 * Ball position tracker.
 *
 * Maintains a 3D position (x, y, z) and exposes helpers to move the ball
 * along any axis.
 */

export interface Position {
  x: number;
  y: number;
  z: number;
}

export class Ball {
  private pos: Position;

  constructor(initial: Partial<Position> = {}) {
    this.pos = { x: initial.x ?? 0, y: initial.y ?? 0, z: initial.z ?? 0 };
  }

  /** Return a copy of the current position. */
  position(): Position {
    return { ...this.pos };
  }

  /** Move the ball by the given deltas. */
  move(delta: Partial<Position>): Position {
    this.pos.x += delta.x ?? 0;
    this.pos.y += delta.y ?? 0;
    this.pos.z += delta.z ?? 0;
    return this.position();
  }
}
