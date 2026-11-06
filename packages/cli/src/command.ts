/** Where a command runs and writes. Tests pass their own; the bin takes the process's. */
export interface Io {
  cwd: string;
  stdout(text: string): void;
  stderr(text: string): void;
}

/** A command's entry: it returns the exit code (ADR-0076). A thrown error is a usage error. */
export type RunCommand = (args: string[], io: Io) => Promise<number>;
