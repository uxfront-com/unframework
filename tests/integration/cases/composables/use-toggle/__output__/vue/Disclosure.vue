<script setup lang="ts">
import { useToggle } from "./useToggle";

const { on, toggle, close } = useToggle(false);
</script>

<template>
  <section class="disclosure" aria-label="Shipping">
    <button type="button" :aria-expanded="on" @click="toggle()">Shipping details</button>
    <div v-if="on" class="panel">
      <p>Orders ship within two days.</p>
      <button type="button" @click="close()">Close</button>
    </div>
  </section>
</template>
