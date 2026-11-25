import { looseToNumber } from "./looseToNumber";

/**
 * Vue's `vModelText` (ADR-0054): the text a field shows for its model's value. It keeps the
 * field's own text where that text already means the value (`12.5kg` for `12.5` with a number
 * cast), or where the person is editing a trimmed field whose trimmed text is the value.
 */
export function modelText(
  field: HTMLInputElement | HTMLTextAreaElement,
  value: unknown,
  modifiers: { trim?: boolean; number?: boolean },
): string {
  const text = field.value;
  const current = modifiers.number && !/^0\d/.test(text) ? looseToNumber(text) : text;
  const next = value ?? "";
  if (current === next) return text;
  const editing = field.ownerDocument.activeElement === field && field.type !== "range";
  if (editing && modifiers.trim && text.trim() === next) return text;
  return String(next);
}
