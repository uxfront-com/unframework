<script setup lang="ts">
const { label } = defineProps<{ label: string }>();
const min = defineModel<number>("min", { default: 0 });
const max = defineModel<number>("max", { default: 100 });

function widen() {
  min.value -= 10;
  max.value += 10;
}
</script>

<template>
  <fieldset>
    <legend>{{ label }}</legend>
    <p>From {{ min }} to {{ max }}</p>
    <button type="button" @click="widen">Widen</button>
  </fieldset>
</template>
