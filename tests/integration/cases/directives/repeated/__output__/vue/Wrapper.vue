<script setup lang="ts">
import Rows from "./Rows.vue";

const slots = defineSlots<{ row?(): unknown }>();
</script>

<template>
  <section class="wrapper" aria-label="Rows">
    <Rows>
      <template v-if="slots.row" #row>
        <slot name="row" />
      </template>
    </Rows>
  </section>
</template>
