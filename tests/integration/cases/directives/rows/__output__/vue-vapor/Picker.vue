<script setup vapor lang="ts">
import { shallowRef } from "vue";

defineSlots<{ option?(props: { option: { id: string; label: string } }): unknown }>();

const options = shallowRef([
  { id: "x", label: "Xray" },
  { id: "y", label: "Yankee" },
]);
</script>

<template>
  <div class="picker">
    <ul aria-label="Options">
      <li v-for="option in options" :key="option.id">
        <slot name="option" :option="option" />
      </li>
    </ul>
    <button type="button" @click="options = [...options].reverse()">Reverse options</button>
    <button
      type="button"
      @click="options = options.filter((option) => option.id !== 'y')"
    >Remove option</button>
  </div>
</template>
