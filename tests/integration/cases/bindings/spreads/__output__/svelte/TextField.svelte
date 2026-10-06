<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
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

  let { label, inputId, hintText, field, hint }: TextFieldProps = $props();
</script>

<div class="text-field">
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
