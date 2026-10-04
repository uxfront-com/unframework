<script setup lang="ts">
interface FieldAttributes {
  name: string;
  placeholder?: string;
  autocomplete?: string;
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

const { label, inputId, hintText, field, hint = undefined } = defineProps<TextFieldProps>();
</script>

<template>
  <div class="text-field">
    <label :for="inputId">{{ label }}</label>
    <input
      :id="inputId"
      type="text"
      :name="field.name"
      :placeholder="field.placeholder"
      :autocomplete="field.autocomplete"
      :maxlength="field.maxlength"
      :required="field.required"
      :title="field.title"
    />
    <p :id="hint?.id" class="text-field-hint" :title="hint?.title">{{ hintText }}</p>
  </div>
</template>
