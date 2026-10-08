<script setup lang="ts">
import Notice from "./Notice.vue";
import { ref } from "vue";

const { unread } = defineProps<{ unread: number }>();

const count = ref(unread);
</script>

<template>
  <div class="inbox">
    <Notice v-if="count > 0" :text="`${count} unread`" tone="info" />
    <Notice v-else text="All read" tone="quiet" />
    <button type="button" @click="count = 0">Mark all read</button>
  </div>
</template>
