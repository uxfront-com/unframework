<script setup lang="ts">
import Badge from "./Badge.vue";
import Tag from "./Tag.vue";
import { ref } from "vue";

type NoticeLook = {
  color?: string;
  backgroundColor?: string;
  borderLeft?: string;
  "--notice-accent"?: string;
};

type NoticeVars = { "--notice-gap"?: string };

export interface NoticeProps {
  title: string;
  look?: NoticeLook;
  declarations?: string;
  vars?: NoticeVars;
}

const {
  title,
  look = undefined,
  declarations = undefined,
  vars = undefined,
} = defineProps<NoticeProps>();

const quiet = ref(false);

function toggle() {
  quiet.value = !quiet.value;
}
</script>

<template>
  <div class="notice">
    <p :style="look">{{ title }}</p>
    <Badge
      label="Permanent"
      tone="padding: 2px 6px; color: rgb(120, 30, 30); outline: 1px solid"
      :style="look"
    />
    <p :style="declarations">Read the details before you continue.</p>
    <component
      :is="quiet ? Tag : Badge"
      label="Optional"
      tone="font-weight: 700"
      :style="declarations"
    />
    <p
      :style="quiet
        ? { color: 'rgb(90, 90, 90)' }
        : { color: 'var(--notice-accent, rgb(160, 40, 40))', fontWeight: '700' }"
    >This cannot be undone.</p>
    <button
      type="button"
      :style="vars"
      @click="toggle"
    >{{ quiet ? "Emphasise" : "Quieten" }}</button>
  </div>
</template>
