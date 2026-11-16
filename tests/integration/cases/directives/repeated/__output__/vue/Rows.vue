<script setup lang="ts">
import { shallowRef } from "vue";

defineSlots<{ row?(): unknown }>();

const items = shallowRef([1, 2]);
</script>

<template>
  <div class="rows">
    <ul>
      <li v-for="item in items" :key="item">
        <slot name="row" />
      </li>
    </ul>
    <button type="button" @click="items = [...items, items.length + 1]">Add row</button>
    <button type="button" @click="items = items.slice(0, -1)">Remove row</button>
  </div>
</template>
