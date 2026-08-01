export type MovementInput = Readonly<{
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}>;

export type MovementVector = Readonly<{
  x: number;
  y: number;
}>;

export type FacingDirection = 'down' | 'left' | 'right' | 'up';

const DIAGONAL_NORMALIZER = Math.SQRT1_2;

export function resolveMovementVector(input: MovementInput): MovementVector {
  const horizontal = Number(input.right) - Number(input.left);
  const vertical = Number(input.down) - Number(input.up);

  if (horizontal === 0 || vertical === 0) {
    return { x: horizontal, y: vertical };
  }

  return {
    x: horizontal * DIAGONAL_NORMALIZER,
    y: vertical * DIAGONAL_NORMALIZER,
  };
}

export function resolveFacingDirection(
  movement: MovementVector,
  previous: FacingDirection,
): FacingDirection {
  if (movement.y < 0) {
    return 'up';
  }

  if (movement.y > 0) {
    return 'down';
  }

  if (movement.x < 0) {
    return 'left';
  }

  if (movement.x > 0) {
    return 'right';
  }

  return previous;
}

export function isMoving(movement: MovementVector): boolean {
  return movement.x !== 0 || movement.y !== 0;
}
