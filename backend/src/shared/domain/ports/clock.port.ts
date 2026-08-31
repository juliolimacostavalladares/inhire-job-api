export interface Clock {
  now(): Date;
}

export const CLOCK_PORT = Symbol('Clock');
