<script setup lang="ts">
import { ref, useTemplateRef } from "vue";

const size = ref("M");
const quantity = ref(1);
const note = ref("");
const noteField = useTemplateRef<HTMLInputElement>("noteField");

function onClick() {
  quantity.value = 1;
  size.value = "M";
  note.value = "";
  const input = noteField.value;
  if (input) input.value = "";
}
</script>

<template>
  <section class="shirt-order" aria-label="Shirt order">
    <p role="status">{{ `${quantity} x size ${size}` }}</p>
    <div role="group" aria-label="Size">
      <button
        type="button"
        value="S"
        :aria-pressed="size === 'S'"
        @click="(event) => (size = (event.currentTarget as HTMLButtonElement).value)"
      >Small</button>
      <button
        type="button"
        value="M"
        :aria-pressed="size === 'M'"
        @click="(event) => (size = (event.currentTarget as HTMLButtonElement).value)"
      >Medium</button>
      <button
        type="button"
        value="L"
        :aria-pressed="size === 'L'"
        @click="(event) => (size = (event.currentTarget as HTMLButtonElement).value)"
      >Large</button>
    </div>
    <button type="button" @click="quantity++">Add one</button>
    <label>Note<input
      ref="noteField"
      name="note"
      @input="(event) => (note = (event.currentTarget as HTMLInputElement).value)"
    /></label>
    <p>Note: {{ note }}</p>
    <button type="button" @click="onClick">Reset</button>
  </section>
</template>
