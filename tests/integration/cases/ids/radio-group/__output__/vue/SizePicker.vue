<script setup lang="ts">
import { ref, useId } from "vue";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

const { legend, sizes } = defineProps<SizePickerProps>();

const group = `uf-id-${useId()}`;
const hintId = `uf-id-${useId()}`;
const picked = ref("");

function choose(size: string) {
  picked.value = size;
}
</script>

<template>
  <fieldset class="size-picker" :aria-describedby="hintId">
    <legend>{{ legend }}</legend>
    <p :id="hintId">Pick one size.</p>
    <div v-for="(size, index) in sizes" :key="size" class="size">
      <input
        :id="`${group}-${index}`"
        type="radio"
        :name="group"
        :value="size"
        @change="choose(size)"
      />
      <label :for="`${group}-${index}`">{{ size }}</label>
    </div>
    <output>{{ picked || "none" }}</output>
  </fieldset>
</template>
