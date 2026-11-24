<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface FieldProps {
    label: string;
    hint: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["p"],
    "label" | "hint" | "children" | "class" | "style" | "ref"
  > &
    FieldProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["p"] | null };

  let {
    label,
    hint,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  const uid = $props.id();
  const inputId = `uf-id-${uid}-0`;
  const hintId = `uf-id-${uid}-1`;
</script>

<p class={["field", className]} {style} bind:this={ref} {...attributes}>
  <label for={inputId}>{label}</label><input id={inputId} type="text" aria-describedby={hintId}
  /><small id={hintId}>{hint}</small>
</p>
