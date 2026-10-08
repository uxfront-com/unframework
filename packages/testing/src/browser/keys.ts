// The keys of `view.user.type` and `view.user.keyboard` (ADR-0050), in the part of Vitest's
// `userEvent.keyboard` syntax that names each key once: a character types itself, `{Enter}`
// presses and releases a key as Playwright names it, `{Shift>}` holds it and `{/Shift}` releases
// it, and `{{` and `[[` type a brace and a bracket. The rest of that syntax (`[KeyA]` codes,
// `{a>3}` repeats, `{\}}` escapes) is refused, so no text means something else here than there.

/** One key of the text: a press, a release, or both, in that order. */
export interface KeyInput {
  /** A key as Playwright's keyboard names it (`Enter`, `Shift`), or one character. */
  key: string;
  /** Whether it is a character, which a keyboard layout without it inserts as text instead. */
  text: boolean;
  press: boolean;
  release: boolean;
}

/** The syntax, for the refusals. */
const SYNTAX =
  "a character types itself, {Enter} presses and releases a key as Playwright names it ({Escape}, {ArrowDown}, {Backspace}), {Shift>} holds it and {/Shift} releases it, and {{ and [[ type a brace and a bracket";

/**
 * The keys of a text, in order, checked against the keys already held (and those the text holds
 * on the way): a key is pressed only when it is not held, and released alone only when it is.
 * Throws for an empty text and for anything outside the syntax, naming the action.
 */
export function parseKeys(
  text: string,
  action: string,
  held: ReadonlySet<string> = new Set(),
): KeyInput[] {
  const refuse = (problem: string): never => {
    throw new TypeError(`${action}: ${problem} in ${JSON.stringify(text)}: ${SYNTAX}.`);
  };
  if (text === "") refuse("no key to press");
  const keys: KeyInput[] = [];
  const holding = new Set(held);
  const add = (written: string, key: string, press: boolean, release: boolean) => {
    if (press && holding.has(key)) refuse(`${written} presses ${key}, which is held already`);
    if (!press && !holding.has(key)) refuse(`${written} releases ${key}, which is not held`);
    if (!release) holding.add(key);
    if (!press) holding.delete(key);
    keys.push({ key, text: isCharacter(key), press, release });
  };
  const chars = characters(text);
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index]!;
    if ((char === "{" || char === "[") && chars[index + 1] === char) {
      add(char + char, char, true, true);
      index += 1;
    } else if (char === "[") {
      refuse("a key code in brackets ([KeyA]) is not supported");
    } else if (char !== "{") {
      add(char, char, true, true);
    } else {
      const end = chars.indexOf("}", index + 1);
      if (end === -1) refuse(`the "{" at ${index} is never closed`);
      const tag = chars.slice(index + 1, end).join("");
      const match = /^(\/)?([^{}/>[\]\\]+)(>)?$/u.exec(tag);
      if (!match || (match[1] && match[3])) refuse(`{${tag}} is not a key`);
      const [, release, key = "", hold] = match!;
      add(`{${tag}}`, key, !release, !hold);
      index = end;
    }
  }
  return keys;
}

/** Whether a key is one character, which a keyboard layout without it inserts as text. */
export function isCharacter(key: string): boolean {
  return characters(key).length === 1;
}

/**
 * The characters of a text as Playwright's keyboard types them, a code point at a time (its
 * `keyboard.type` loops with `for … of`): an emoji of several code points is several keys there
 * too, so a grapheme is not one character here.
 */
function characters(text: string): string[] {
  return Array.from(text);
}
