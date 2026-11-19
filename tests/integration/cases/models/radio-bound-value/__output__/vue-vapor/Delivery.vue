<script lang="ts">
export interface DeliveryProps {
  speeds: string[];
  extras: string[];
}
</script>

<script setup vapor lang="ts">
import { ref, shallowRef } from "vue";

const { speeds, extras } = defineProps<DeliveryProps>();

const speed = ref("express");
const chosen = shallowRef<string[]>(["insurance"]);
</script>

<template>
  <section aria-label="Delivery">
    <fieldset>
      <legend>Speed</legend>
      <label
        v-for="value in speeds"
        :key="value"
      ><input v-model="speed" type="radio" name="speed" :value="value" /> {{ value }}</label>
    </fieldset>
    <fieldset>
      <legend>Extras</legend>
      <label
        v-for="extra in extras"
        :key="extra"
      ><input v-model="chosen" type="checkbox" :value="extra" /> {{ extra }}</label>
    </fieldset>
    <output>Speed: {{ speed }}, extras: {{ chosen.join(", ") || "none" }}</output>
  </section>
</template>
