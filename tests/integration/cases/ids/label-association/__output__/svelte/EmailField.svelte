<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface EmailFieldProps {
    label: string;
    hint: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "label" | "hint" | "children" | "class" | "style" | "ref"
  > &
    EmailFieldProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["div"] | null;
    };

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

<div class={["email-field", className]} {style} bind:this={ref} {...attributes}>
  <label for={inputId}>{label}</label
  ><input id={inputId} name="email" type="email" aria-describedby={hintId}
  /><p id={hintId}>{hint}</p>
</div>
