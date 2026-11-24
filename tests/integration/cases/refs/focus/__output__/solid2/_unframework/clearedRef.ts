import { onCleanup } from "solid-js";

/** A `ref` that calls `callback` with its element, and `clear` once the element is removed. */
export function clearedRef<T>(
  callback: (element: T) => void,
  clear: () => void,
): (element: T) => void {
  onCleanup(clear);
  return callback;
}
