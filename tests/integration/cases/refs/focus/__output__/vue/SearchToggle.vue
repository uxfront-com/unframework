<script setup lang="ts">
import { useTemplateRef } from "vue";

const field = useTemplateRef<HTMLInputElement>("field");
const trigger = useTemplateRef<HTMLButtonElement>("trigger");

function focusField() {
  field.value?.focus();
}

function returnFocus(event: KeyboardEvent) {
  if (event.key === "Escape") trigger.value?.focus();
}
</script>

<template>
  <div class="search-toggle" role="search">
    <button ref="trigger" type="button" @click="focusField">Search</button>
    <input ref="field" name="query" aria-label="Search the docs" @keydown="returnFocus" />
  </div>
</template>
