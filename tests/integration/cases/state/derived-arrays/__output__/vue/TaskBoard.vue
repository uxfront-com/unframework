<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from "vue";

export interface Task {
  id: number;
  title: string;
  kind: string;
  rank: number;
  done: boolean;
}

export interface Filters {
  query: string;
  tags: string[];
}

export interface TaskBoardProps {
  initial: Task[];
}

const { initial } = defineProps<TaskBoardProps>();

const tasks = shallowRef(initial);
const filters = shallowRef<Filters>({ query: "", tags: [] });
const notes = useTemplateRef<HTMLTextAreaElement>("notes");
const open = computed(() =>
  tasks.value.filter((task) => !task.done).sort((a, b) => a.rank - b.rank),
);
const alphabetical = computed(() =>
  tasks.value.slice().sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0)),
);
const newestFirst = computed(() => tasks.value.map((task) => task.title).reverse());

const kinds = computed(() => {
  const byKind: Record<string, Task[]> = {};
  for (const task of tasks.value) {
    if (!byKind[task.kind]) byKind[task.kind] = [];
    byKind[task.kind]!.push(task);
  }
  return Object.keys(byKind).map((kind) => `${kind}: ${byKind[kind]!.length}`);
});

const byId = computed(() =>
  tasks.value.reduce<Record<number, Task>>((acc, task) => {
    acc[task.id] = task;
    return acc;
  }, {}),
);

const titlesByKind = computed(() =>
  tasks.value.reduce<Record<string, string[]>>((acc, task) => {
    (acc[task.kind] ||= []).push(task.title);
    return acc;
  }, {}),
);

const finishedByKind = computed(() =>
  tasks.value.reduce((acc, task) => {
    if (task.done) acc.set(task.kind, (acc.get(task.kind) ?? 0) + 1);
    return acc;
  }, new Map<string, number>()),
);

const byState = computed(() => {
  const groups: Record<string, string[]> = {};
  for (const task of tasks.value) {
    const state = task.done ? "done" : "open";
    groups[state] ??= [];
    groups[state]!.push(task.title);
  }
  return groups;
});

const progress = computed(() =>
  Math.round((tasks.value.filter((task) => task.done).length / tasks.value.length) * 100),
);

function finish(id: number) {
  tasks.value = tasks.value.map((task) => (task.id === id ? { ...task, done: true } : task));
}

function addTag(tag: string) {
  const next = { ...filters.value, tags: [...filters.value.tags] };
  next.tags.push(tag);
  filters.value = next;
}

function resize() {
  const field = notes.value;
  if (!field) return;
  const lines = field.value.split("\n").length;
  field.style.height = `${Math.max(lines, 2) * 1.5}em`;
  field.classList.toggle("tall", lines > 3);
}

function sizeSummary(event: Event) {
  const area = event.currentTarget as HTMLTextAreaElement;
  const lines = area.value.split("\n").length;
  area.style.height = `${Math.max(lines, 2) * 1.5}em`;
  area.classList.toggle("tall", lines > 3);
}
</script>

<template>
  <section class="task-board" aria-label="Tasks">
    <ol aria-label="Open">
      <li
        v-for="task in open"
        :key="task.id"
        :class="{ first: task.rank === 1 }"
      >{{ task.title }}<button
        type="button"
        @click="finish(task.id)"
      >{{ `Finish ${task.title}` }}</button></li>
    </ol>
    <div class="meter" role="presentation">
      <div class="fill" :style="{ width: `${progress}%` }"></div>
    </div>
    <p>Alphabetical: {{ alphabetical.map((task) => task.title).join(", ") }}</p>
    <p>Newest first: {{ newestFirst.join(", ") }}</p>
    <ul aria-label="Kinds">
      <li v-for="line in kinds" :key="line">{{ line }}</li>
    </ul>
    <p>Task 2: {{ byId[2]?.title }}</p>
    <p>Code tasks: {{ titlesByKind["code"]?.join(", ") }}</p>
    <p>Finished code tasks: {{ finishedByKind.get("code") ?? 0 }}</p>
    <p>Done: {{ byState["done"]?.join(", ") ?? "nothing" }}</p>
    <button type="button" @click="addTag('urgent')">Tag urgent</button>
    <button type="button" @click="addTag('later')">Tag later</button>
    <p>Tags: {{ filters.tags.join(", ") }}</p>
    <label>Notes<textarea ref="notes" name="notes" class="notes" @input="resize"></textarea></label>
    <label>Summary<textarea name="summary" class="summary" @input="sizeSummary"></textarea></label>
  </section>
</template>
