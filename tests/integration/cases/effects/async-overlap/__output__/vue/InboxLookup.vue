<script setup lang="ts">
import { nextTick, ref, shallowRef, watch, watchPostEffect } from "vue";

const emit = defineEmits<{
  looked: [sender: string];
  dropped: [sender: string];
  sorted: [order: string];
  scaled: [order: string];
  busy: [count: number, loading: boolean];
  failed: [message: string, loading: boolean];
  counted: [count: number];
}>();

const sender = ref("");
const order = ref("newest");
const answers = shallowRef<string[]>([]);
const ordering = ref("none");
const messages = shallowRef<string[]>([]);
const loading = ref(false);
const failure = ref("");
const unread = ref(0);
let lookupReplies: ((text: string) => void)[] = [];
let orderReply: ((text: string) => void) | undefined;
let respond: ((list: string[]) => void) | undefined;
let fail: ((error: Error) => void) | undefined;

function lookupReply(): Promise<string> {
  return new Promise<string>((resolve) => {
    lookupReplies = [...lookupReplies, resolve];
  });
}

function answerLookups() {
  const waiting = lookupReplies;
  lookupReplies = [];
  waiting.forEach((resolve) => resolve("found"));
}

function request(): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    respond = resolve;
    fail = reject;
  });
}

watch(sender, async (value, previous, onCleanup) => {
  let cancelled = false;
  onCleanup(() => {
    cancelled = true;
    emit("dropped", value);
  });
  emit("looked", value);
  const text = await lookupReply();
  if (!cancelled) {
    answers.value = [...answers.value, `${value}: ${text}`];
  }
});

watchPostEffect(async (onCleanup) => {
  const current = order.value;
  let cancelled = false;
  onCleanup(() => {
    cancelled = true;
  });
  emit("sorted", current);
  const text = await new Promise<string>((resolve) => {
    orderReply = resolve;
  });
  if (!cancelled) {
    ordering.value = `${current} ${text}`;
    emit("scaled", current);
  }
});

watch([() => messages.value, loading], ([list, busy]) => {
  emit("busy", list.length, busy);
});

watch([failure, loading], ([message, busy]) => {
  emit("failed", message, busy);
});

watch(unread, (value) => {
  emit("counted", value);
});

async function load() {
  loading.value = true;
  failure.value = "";
  try {
    const list = await request();
    messages.value = list;
  } catch (error) {
    failure.value = error instanceof Error ? error.message : "unknown";
  }
  loading.value = false;
}

async function refresh() {
  loading.value = true;
  messages.value = await request();
  loading.value = false;
}

async function markTwice() {
  const bump = () => {
    unread.value += 1;
  };
  bump();
  bump();
  await nextTick();
  bump();
  bump();
}

function onClick() {
  orderReply?.("ready");
}

function onClick_1() {
  respond?.(["Hello", "Welcome"]);
}

function onClick_2() {
  fail?.(new Error("offline"));
}
</script>

<template>
  <section class="inbox-lookup" aria-label="Inbox">
    <button type="button" @click="sender = 'Ann'">Find Ann</button>
    <button type="button" @click="sender = 'Anna'">Find Anna</button>
    <button type="button" @click="answerLookups">Answer lookups</button>
    <ol aria-label="Answers">
      <li v-for="(line, index) in answers" :key="index">{{ line }}</li>
    </ol>
    <button
      type="button"
      @click="order = order === 'newest' ? 'oldest' : 'newest'"
    >Switch order</button>
    <button type="button" @click="onClick">Answer order</button>
    <p>Order: {{ ordering }}</p>
    <button type="button" @click="load">Load</button>
    <button type="button" @click="refresh">Refresh</button>
    <button type="button" @click="onClick_1">Reply</button>
    <button type="button" @click="onClick_2">Fail</button>
    <p
      role="status"
    >{{ loading ? "Loading" : `${messages.length} messages` }}{{ failure === "" ? "" : `, ${failure}` }}</p>
    <button type="button" @click="markTwice">Mark twice</button>
    <p>Unread: {{ unread }}</p>
  </section>
</template>
