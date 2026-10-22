<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";
  import { on } from "svelte/events";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let count = $state(2);
  let volume = $state(5);

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

<section aria-label="Order" class={className} {style} {...scopeAttributes(attributes)}>
  <input
    type="number"
    aria-label="Count"
    min="0"
    value={untrack(() => count)} {@attach modelText(() => count, (value) => (count = value), { number: true })}
  /><input
    type="range"
    aria-label="Volume"
    min="0"
    max="10"
    value={untrack(() => volume)} {@attach modelText(() => volume, (value) => (volume = value), { number: true })}
  /><output>Next: {count + 1}, volume {volume + 1}</output
  ><button type="button" onclick={() => (count = 10)}>Ten</button>
</section>
