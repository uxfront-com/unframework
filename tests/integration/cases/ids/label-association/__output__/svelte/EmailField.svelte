<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface EmailFieldProps {
    label: string;
    hint: string;
  }

  type Props = EmailFieldProps & { class?: ClassValue; style?: string };

  let { label, hint, class: className, style }: Props = $props();

  const uid = $props.id();
  const inputId = `uf-id-${uid}-0`;
  const hintId = `uf-id-${uid}-1`;
</script>

<div class={["email-field", className]} {style}>
  <label for={inputId}>{label}</label
  ><input id={inputId} name="email" type="email" aria-describedby={hintId}
  /><p id={hintId}>{hint}</p>
</div>
