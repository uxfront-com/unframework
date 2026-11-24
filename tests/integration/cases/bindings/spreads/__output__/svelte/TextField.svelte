<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
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
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "label" | "inputId" | "hintText" | "field" | "hint" | "children" | "class" | "style" | "ref"
  > &
    TextFieldProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["div"] | null;
    };

  let {
    label,
    inputId,
    hintText,
    field,
    hint,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<div class={["text-field", className]} {style} bind:this={ref} {...attributes}>
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
