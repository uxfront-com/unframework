<script setup lang="ts">
import Tag from "./Tag.vue";
import { ref } from "vue";

const active = ref(false);
</script>

<template>
  <div class="tags">
    <Tag label="plain" />
    <Tag label="wide" class="wide" style="margin-left: 8px" />
    <Tag
      label="toggled"
      class="picked"
      :class="{ active }"
      :style="{ color: active ? 'rgb(200, 0, 0)' : undefined }"
    />
    <button type="button" @click="active = !active">Toggle</button>
  </div>
</template>
