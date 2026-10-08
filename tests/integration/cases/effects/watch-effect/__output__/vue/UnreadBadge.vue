<script setup lang="ts">
import { ref, watchPostEffect } from "vue";

export interface UnreadBadgeProps {
  appName: string;
}

const { appName } = defineProps<UnreadBadgeProps>();
const emit = defineEmits<{ titleChange: [title: string]; titleRelease: [title: string] }>();

const unread = ref(0);

watchPostEffect((onCleanup) => {
  const title = `(${unread.value}) ${appName}`;
  emit("titleChange", title);
  onCleanup(() => {
    emit("titleRelease", title);
  });
});
</script>

<template>
  <section class="unread-badge" aria-label="Inbox">
    <p role="status">{{ unread }} unread</p>
    <button type="button" @click="unread++">Receive a message</button>
    <button type="button" @click="unread = 0">Mark all read</button>
  </section>
</template>
