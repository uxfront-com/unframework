<script setup lang="ts">
import { ref } from "vue";

export interface QuickActionsProps {
  actions: string[];
}

const { actions } = defineProps<QuickActionsProps>();
const emit = defineEmits<{
  welcomed: [];
  subscribed: [count: number];
  chosen: [action: string, scope: string];
}>();

const query = ref("");
const lastKey = ref("none");
const scope = ref("mine");
const subscriptions = ref(0);

function clear(event: KeyboardEvent) {
  event.preventDefault();
  query.value = "";
}

function track(event: KeyboardEvent): boolean {
  lastKey.value = event.key;
  return event.key === "Enter";
}

function keyFor(action: string, event: KeyboardEvent): boolean {
  lastKey.value = `${action}: ${event.key}`;
  return false;
}

function choose(action: string, current: string) {
  emit("chosen", action, current);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") clear(event);
}

function onSubmit(event: SubmitEvent) {
  event.preventDefault();
  subscriptions.value += 1;
  emit("subscribed", subscriptions.value);
}
</script>

<template>
  <section class="quick-actions" aria-label="Quick actions">
    <label>Search<input
      name="query"
      @input="(event) => (query = (event.currentTarget as HTMLInputElement).value)"
      @keydown="onKeydown"
    /></label>
    <p>Query: {{ query }}</p>
    <label>Note<input name="note" @keydown="(event) => track(event)" /></label>
    <label>Scope<select
      name="scope"
      @change="(event) => (scope = (event.currentTarget as HTMLSelectElement).value)"
    ><option value="mine">Mine</option><option value="team">Team</option></select></label>
    <ul aria-label="Actions">
      <li v-for="action in actions" :key="action">
        <label>{{ `Shortcut for ${action}` }}<input
          :name="action"
          @keydown="(event) => keyFor(action, event)"
        /></label>
        <button type="button" @click="choose(action, scope)">{{ `Run ${action}` }}</button>
      </li>
    </ul>
    <p>Last key: {{ lastKey }}</p>
    <form
      class="subscribe"
      aria-label="Subscribe"
      @submit.prevent.once="emit('welcomed')"
      @submit="onSubmit"
    >
      <p>Subscriptions: {{ subscriptions }}</p>
      <button type="submit">Subscribe</button>
    </form>
  </section>
</template>
