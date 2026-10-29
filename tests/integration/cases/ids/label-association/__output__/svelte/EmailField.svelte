<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface EmailFieldProps {
    label: string;
    hint: string;
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = EmailFieldProps & { class?: ClassValue; style?: string };

  let { label, hint, class: className, style, ...attributes }: Props = $props();

  const uid = $props.id();
  const inputId = `uf-id-${uid}-0`;
  const hintId = `uf-id-${uid}-1`;

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["email-field", className]} {style} {...scopeAttributes(attributes)}>
  <label for={inputId}>{label}</label
  ><input id={inputId} name="email" type="email" aria-describedby={hintId}
  /><p id={hintId}>{hint}</p>
</div>
