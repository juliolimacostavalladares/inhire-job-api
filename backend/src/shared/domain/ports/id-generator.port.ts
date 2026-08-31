export interface IdGenerator {
  generate(): string;
}

export const ID_GENERATOR_PORT = Symbol('IdGenerator');
