<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  interface FieldAttributes {
    name: string;
    placeholder?: string;
    autocomplete?: "email" | "username";
    maxlength?: number;
    required?: boolean;
    title?: string;
  }

  interface HintAttributes {
    id: string;
    title?: string;
  }

  export interface TextFieldProps {
    label: string;
    inputId: string;
    hintText: string;
    field: FieldAttributes;
    hint?: HintAttributes;
  }

  type Props = TextFieldProps & { class?: ClassValue; style?: string };

  let {
    label,
    inputId,
    hintText,
    field,
    hint,
    class: className,
    style,
    ...attributes
  }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["text-field", className]} {style} {...scopeAttributes(attributes)}>
  <label for={inputId}>{label}</label
  ><input
    id={inputId}
    type="text"
    name={field.name}
    placeholder={field.placeholder}
    autocomplete={field.autocomplete}
    maxlength={field.maxlength}
    required={field.required}
    title={field.title}
  /><p class="text-field-hint" id={hint?.id} title={hint?.title}>{hintText}</p>
</div>
