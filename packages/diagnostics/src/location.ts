/** A 1-based line and column, in UTF-16 code units. */
export interface Position {
  line: number;
  column: number;
  offset: number;
}

/** Maps offsets to lines and columns for one source text. */
export class LineIndex {
  readonly #starts: number[] = [0];
  readonly source: string;

  constructor(source: string) {
    this.source = source;
    for (let index = 0; index < source.length; index++) {
      const char = source.charCodeAt(index);
      if (char === 10 /* \n */) this.#starts.push(index + 1);
      else if (char === 13 /* \r */) {
        if (source.charCodeAt(index + 1) === 10) index++;
        this.#starts.push(index + 1);
      }
    }
  }

  /** The number of lines. */
  get lineCount(): number {
    return this.#starts.length;
  }

  /** The position of an offset, clamped to the source. */
  position(offset: number): Position {
    const clamped = Math.max(0, Math.min(offset, this.source.length));
    let low = 0;
    let high = this.#starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (this.#starts[middle]! <= clamped) low = middle;
      else high = middle - 1;
    }
    return { line: low + 1, column: clamped - this.#starts[low]! + 1, offset: clamped };
  }

  /** The text of a 1-based line, without its line break. */
  line(line: number): string {
    const start = this.#starts[line - 1];
    if (start === undefined) return "";
    const next = this.#starts[line];
    const end = next === undefined ? this.source.length : next;
    return this.source.slice(start, end).replace(/\r?\n$|\r$/, "");
  }
}

/**
 * Resolves offsets in several files for machine-readable output. Unlike {@link LineIndex}, it
 * never clamps: a file missing from `sources`, or an offset outside its file, throws, so JSON
 * and SARIF never record a position that is not in the file.
 */
export function strictPositions(
  sources: ReadonlyMap<string, string>,
  caller: string,
): (file: string, offset: number) => Position {
  const indexes = new Map<string, LineIndex>();
  return (file, offset) => {
    let index = indexes.get(file);
    if (!index) {
      const source = sources.get(file);
      if (source === undefined) {
        throw new TypeError(
          `${caller}: no source for "${file}"; pass the source of every diagnostic's file.`,
        );
      }
      index = new LineIndex(source);
      indexes.set(file, index);
    }
    if (!Number.isInteger(offset) || offset < 0 || offset > index.source.length) {
      throw new RangeError(
        `${caller}: offset ${offset} is outside "${file}" (${index.source.length} characters).`,
      );
    }
    return index.position(offset);
  };
}
