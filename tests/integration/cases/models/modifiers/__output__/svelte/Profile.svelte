<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";
  import { on } from "svelte/events";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let name = $state("");
  let city = $state("Lisbon");
  let weight = $state(0);

  function modelText<T>(
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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<form aria-label="Profile" class={className} {style} {...scopeAttributes(attributes)}>
  <label>Name <input
    value={untrack(() => name)} {@attach modelText(() => name, (value) => (name = value), { trim: true })}
  /></label
  ><label>City <input
    value={untrack(() => city)} {@attach modelText(() => city, (value) => (city = value), { lazy: true })}
  /></label
  ><label>Weight <input
    value={untrack(() => weight)} {@attach modelText(() => weight, (value) => (weight = value), { number: true })}
  /></label
  ><output>[{name}] from {city}, {weight + 1}</output>
</form>
