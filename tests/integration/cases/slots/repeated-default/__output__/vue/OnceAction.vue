<script setup lang="ts">
import OnceSlot from "./OnceSlot.vue";
import type { IntrinsicElementAttributes } from "vue";

const { href = undefined, label } = defineProps<
  { href?: string; label: string } & /* @vue-ignore */ Omit<
    IntrinsicElementAttributes["a"] & IntrinsicElementAttributes["button"],
    "href" | "label"
  >
>();
defineSlots<{ default?(): unknown }>();
</script>

<template>
  <component :is="href ? 'a' : 'button'" :href="(href ? 'a' : 'button') === 'a' ? href : undefined">
    <OnceSlot :label="label">
      <template #text="shown">
        <span class="once-fill">
          <slot>{{ shown.label }}</slot>
        </span>
      </template>
    </OnceSlot>
  </component>
</template>
