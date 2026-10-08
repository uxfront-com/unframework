<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch, watchPostEffect } from "vue";

export interface MailboxProps {
  folder: string;
}

const { folder } = defineProps<MailboxProps>();
const emit = defineEmits<{
  loaded: [name: string, unread: number];
  progress: [status: string, attempts: number];
  seen: [text: string];
  noted: [text: string];
}>();

const name = ref("Loading");
const unread = ref(0);
const status = ref("idle");
const attempts = ref(0);
const summary = ref("No messages");
let timer: ReturnType<typeof setInterval> | undefined;

watch([name, unread], ([nextName, nextUnread]) => {
  emit("loaded", nextName, nextUnread);
});

watch([status, attempts], ([nextStatus, nextAttempts]) => {
  emit("progress", nextStatus, nextAttempts);
});

watch(unread, async (value) => {
  const text = await Promise.resolve(`${value} unread`);
  summary.value = text;
});

watchPostEffect(async () => {
  const text = `${status.value} after ${attempts.value}`;
  await Promise.resolve();
  emit("seen", text);
});

onMounted(async () => {
  await Promise.resolve();
  name.value = folder;
  unread.value = 3;
});

onUnmounted(() => {
  clearInterval(timer);
});

async function save() {
  const label = name.value.trim();
  status.value = `saving ${label}`;
  attempts.value += 1;
  await nextTick();
  status.value = "saved";
}

function refreshEverySecond() {
  clearInterval(timer);
  timer = setInterval(() => {
    name.value = `${folder} (refreshed)`;
    unread.value += 1;
  }, 1000);
}

function markAllRead() {
  queueMicrotask(() => {
    unread.value = 0;
    name.value = `${folder}, all read`;
  });
}

function note() {
  void Promise.resolve().then(() => {
    emit("noted", `${name.value}: ${unread.value}`);
  });
}
</script>

<template>
  <section class="mailbox" aria-label="Mailbox">
    <h2>{{ name }}</h2>
    <p role="status">{{ summary }}</p>
    <p>Status: {{ status }}</p>
    <button type="button" @click="save">Save</button>
    <button type="button" @click="refreshEverySecond">Refresh every second</button>
    <button type="button" @click="markAllRead">Mark all read</button>
    <button type="button" @click="note">Note</button>
  </section>
</template>
