<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, HTMLFormAttributes } from "svelte/elements";
  import { on } from "svelte/events";

  type Props = Omit<HTMLFormAttributes, "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["form"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let message = $state("Thanks, see you soon");
  let signature = $state("Ada");

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
</script>

<form aria-label="Reply" class={className} {style} bind:this={ref} {...attributes}>
  <textarea
    aria-label="Message"
    value={untrack(() => message)} {@attach modelText(() => message, (value) => (message = value), { trim: true })}
  ></textarea
  ><textarea
    aria-label="Signature"
    value={untrack(() => signature)} {@attach modelText(() => signature, (value) => (signature = value), { lazy: true })}
  ></textarea
  ><output>[{message}] from {signature}</output>
</form>
