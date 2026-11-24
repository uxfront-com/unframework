import { on } from "svelte/events";

export function modelText<T>(
  get: () => T,
  set: (value: T) => void,
  { trim = false, lazy = false, number = false } = {},
) {
  const cast = (text: string): string | number => {
    const parsed = Number.parseFloat(text);
    return Number.isNaN(parsed) ? text : parsed;
  };
  return (field: HTMLInputElement | HTMLTextAreaElement) => {
    $effect(() => {
      const value = get() ?? "";
      const shown = number && !/^0\d/.test(field.value) ? cast(field.value) : field.value;
      if (shown === value) return;
      const typing = document.activeElement === field && field.type !== "range";
      if (typing && trim && field.value.trim() === value) return;
      field.value = String(value);
    });
    const stopWriting = on(field, lazy ? "change" : "input", () => {
      const text = trim ? field.value.trim() : field.value;
      set((number ? cast(text) : text) as T);
    });
    const stopTrimming = on(field, "change", () => {
      if (trim) field.value = field.value.trim();
    });
    return () => {
      stopWriting();
      stopTrimming();
    };
  };
}
