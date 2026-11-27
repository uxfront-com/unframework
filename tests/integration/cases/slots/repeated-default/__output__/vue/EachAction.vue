<script setup lang="ts">
import EachSlot from "./EachSlot.vue";
import type { IntrinsicElementAttributes } from "vue";

const { href = undefined, items } = defineProps<
  { href?: string; items: string[] } & /* @vue-ignore */ Omit<
    IntrinsicElementAttributes["a"] & IntrinsicElementAttributes["button"],
    "href" | "items"
  >
>();
defineSlots<{ default?(): unknown }>();
</script>

<template>
  <component :is="href ? 'a' : 'button'" :href="(href ? 'a' : 'button') === 'a' ? href : undefined">
    <EachSlot :items="items">
      <template #row="{ item }">
        <span class="each-fill">
          <slot>{{ item }}</slot>
        </span>
      </template>
    </EachSlot>
  </component>
</template>
