<script setup lang="ts">
import { ref, useTemplateRef } from "vue";

export interface CommandMenuProps {
  commands: string[];
}

const { commands } = defineProps<CommandMenuProps>();
const emit = defineEmits<{ run: [command: string]; dismiss: [] }>();

const active = ref(0);
const query = ref("");
const shortcutField = useTemplateRef<HTMLInputElement>("shortcutField");

function handleKey(event: KeyboardEvent) {
  if (event.key === "Enter") event.preventDefault();
  if (event.key === "ArrowDown") {
    active.value = (active.value + 1) % commands.length;
  } else if (event.key === "ArrowUp") {
    active.value = (active.value + commands.length - 1) % commands.length;
  } else if (event.key === "Enter") {
    emit("run", commands[active.value] ?? query.value);
  } else if (event.key === "Escape") {
    active.value = 0;
    emit("dismiss");
  }
}

function clearShortcut() {
  const input = shortcutField.value;
  if (input) input.value = "";
}
</script>

<template>
  <section class="command-menu" aria-label="Command menu">
    <form role="search" aria-label="Commands">
      <label>Command<input
        name="command"
        @input="(event) => (query = (event.currentTarget as HTMLInputElement).value)"
        @keydown="handleKey"
      /></label>
    </form>
    <ul aria-label="Suggestions">
      <li
        v-for="(command, index) in commands"
        :key="command"
        :aria-current="index === active ? 'true' : undefined"
      >{{ command }}</li>
    </ul>
    <label>Shortcut name<input
      ref="shortcutField"
      name="shortcut"
      @keydown="(event) => event.key === 'Escape' && clearShortcut()"
    /></label>
  </section>
</template>
