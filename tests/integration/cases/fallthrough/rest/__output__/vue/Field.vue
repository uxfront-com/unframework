<script setup lang="ts">
import type { IntrinsicElementAttributes } from "vue";

const { label } = defineProps<
  { label: string } & /* @vue-ignore */ (Omit<
    IntrinsicElementAttributes["input"],
    "label" | "autocomplete"
  > &
    Partial<Record<"autocomplete", string>>)
>();
defineOptions({ inheritAttrs: false });

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(attrs).filter(([name]) => name.startsWith("data-uf-")));
}

/** What the consumer passes, but the scope attributes its root keeps. */
function restAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(attrs).filter(([name]) => !name.startsWith("data-uf-")));
}
</script>

<template>
  <label
    class="field"
    v-bind="scopeAttrs($attrs)"
  >{{ label }} <input :name="label.toLowerCase()" v-bind="restAttrs($attrs)" /></label>
</template>
