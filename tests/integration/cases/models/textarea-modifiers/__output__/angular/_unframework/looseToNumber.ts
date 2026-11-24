/** Vue's `looseToNumber`: the text's leading number, or the text when it has none. */
export function looseToNumber(text: string): string | number {
  const number = Number.parseFloat(text);
  return Number.isNaN(number) ? text : number;
}
