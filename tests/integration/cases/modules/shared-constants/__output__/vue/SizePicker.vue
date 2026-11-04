<script setup lang="ts">
import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";
import { shallowRef } from "vue";

const size = shallowRef<Size>(DEFAULT_SIZE);

function pick(next: Size) {
  size.value = next;
}
</script>

<template>
  <fieldset class="size-picker">
    <legend>Size</legend>
    <p role="status">Picked: {{ SIZES[size] }}</p>
    <ul>
      <li v-for="each in SIZE_ORDER" :key="each">
        <button
          type="button"
          :aria-pressed="size === each"
          @click="pick(each)"
        >{{ SIZES[each] }}</button>
      </li>
    </ul>
  </fieldset>
</template>
