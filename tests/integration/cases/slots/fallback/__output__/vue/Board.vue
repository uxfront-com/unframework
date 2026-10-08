<script setup lang="ts">
import Notice from "./Notice.vue";

const { build } = defineProps<{ build: string }>();
</script>

<template>
  <div>
    <Notice label="Build">
      <template #default>Build {{ build }} failed.</template>
      <template #action>
        <a href="#logs">See the logs</a>
      </template>
    </Notice>
    <Notice label="Deploy" />
  </div>
</template>
