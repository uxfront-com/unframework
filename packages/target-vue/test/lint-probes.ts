// M1's constructs in this target's shapes, written by hand:
// `<script setup lang="ts">` with `defineProps<P>()` destructured, with a default for every
// optional prop (`undefined` when the source has none), or `withDefaults`,
// `v-if`/`v-else-if`/`v-else`, keyed `v-for`, `class` beside `:class`, `:style`, attributes in
// `vue/attributes-order`. The same three components on every target: a badge (props with defaults,
// a conditional chain, class and style bindings, bound attributes, SVG), a list (nested keyed
// lists, conditionals inside and around them, a root fragment) and a card (the `props` form, a
// typed spread written out key by key, a static style). lint.test.ts pins the L5 configuration
// against them (ADR-0042): a rule that rejects one of them would force an emitter change.

/** File name → contents. */
export const M1_SHAPES: Readonly<Record<string, string>> = {
  "Badge.vue": `<script setup lang="ts">
export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  count?: number;
  pill?: boolean;
  gap?: string;
  quiet?: boolean;
}

const {
  label,
  tone = "info",
  count = undefined,
  pill = false,
  gap = undefined,
  quiet = undefined,
} = defineProps<BadgeProps>();
</script>

<template>
  <span
    id="badge"
    class="badge"
    :class="[{ pill }, \`tone-\${tone}\`]"
    :style="{ color: 'red', lineHeight: 1.5, marginTop: gap, '--gap': gap }"
    :aria-hidden="quiet"
    :data-tone="tone"
    :title="label"
  >
    <strong v-if="count !== undefined && count > 0">{{ count }}</strong>
    <template v-else-if="tone === 'warn'">!</template>
    {{ label }}
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <title>Icon</title>
      <circle cx="8" cy="8" r="4" stroke-width="2" />
      <path d="M0 0h16" />
    </svg>
    <input id="count" type="number" :disabled="quiet" tabindex="0" maxlength="10" readonly />
    <label for="count">Count</label>
  </span>
</template>
`,
  "LinkCard.vue": `<script setup lang="ts">
interface LinkAttrs {
  href: string;
  title?: string;
  class?: string;
}

export interface LinkCardProps {
  label: string;
  link: LinkAttrs;
  extra?: { id?: string; role?: string };
  accent?: string;
}

const props = withDefaults(defineProps<LinkCardProps>(), { extra: undefined, accent: undefined });
</script>

<template>
  <div class="card" :class="[props.accent]" style="padding: 4px; border: 1px solid">
    <a :href="props.link.href" :title="props.link.title" class="card-link" :class="[props.link.class]">{{
      props.label
    }}</a>
    <p :id="props.extra?.id" :role="props.extra?.role">More</p>
  </div>
</template>
`,
  "TodoList.vue": `<script setup lang="ts">
interface Todo {
  id: string;
  title: string;
  done?: boolean;
  tags: string[];
}

export interface TodoListProps {
  todos: Todo[];
  heading?: string;
}

const { todos, heading = undefined } = defineProps<TodoListProps>();
</script>

<template>
  <h2 v-if="heading">{{ heading }}</h2>
  <ol v-if="todos.length > 0" class="todos">
    <li v-for="(todo, index) in todos" :key="todo.id" :class="{ done: todo.done }">
      {{ index + 1 }}. {{ todo.title }}
      <ul v-if="todo.tags.length > 0">
        <li v-for="tag in todo.tags" :key="tag">{{ tag }}</li>
      </ul>
    </li>
  </ol>
  <p v-else>Nothing to do.</p>
</template>
`,
};

// What this target emits for M2's constructs (ADR-0045 to ADR-0049), in the shapes its emit tests
// pin: the imports from `vue`, `defineEmits` right after `defineProps`, the setup in source order
// with `.value` as the source writes it, `useTemplateRef("<binding>")`, `uf-id-` ids,
// `watchPostEffect` for `watchEffect`, listeners as `@event` with Vue's modifiers for their options
// and for a handler's leading `stopPropagation()`/`preventDefault()`, an inline statement, an
// arrow that reads its event, a handler the template cannot hold hoisted to a script function, and
// the events declared without a binding when nothing calls `emit`. lint.test.ts pins the L5
// configuration against them.

/** File name → contents. */
export const M2_SHAPES: Readonly<Record<string, string>> = {
  "Counter.vue": `<script setup lang="ts">
import { computed, ref } from "vue";

export interface CounterProps {
  initial?: number;
  step?: number;
}

const { initial = 0, step = 1 } = defineProps<CounterProps>();
const emit = defineEmits<{ change: [value: number] }>();

const count = ref(initial);
const doubled = computed(() => count.value * 2);

function increment() {
  count.value += step;
  emit("change", count.value);
}
</script>

<template>
  <div class="counter">
    <output>{{ count }}</output>
    <span v-if="doubled > 10">Big</span>
    <button type="button" :disabled="count === 0" @click="count--">-1</button>
    <button type="button" @click="increment">+{{ step }}</button>
  </div>
</template>
`,
  "EventLog.vue": `<script setup lang="ts">
import { ref, useTemplateRef } from "vue";

const emit = defineEmits<{ logged: [entries: string[]]; cleared: [] }>();

const log = ref<string[]>([]);
const volume = ref(5);
const note = ref("");
const field = useTemplateRef<HTMLInputElement>("field");

function record(line: string) {
  log.value = [...log.value, line];
}

function changeVolume(event: WheelEvent) {
  volume.value += event.deltaY < 0 ? 1 : -1;
}

function clearField() {
  const input = field.value;
  if (input) input.value = "";
}

function onClick() {
  log.value = [];
  note.value = "";
  clearField();
  emit("cleared");
}
</script>

<template>
  <section class="event-log" aria-label="Events">
    <div role="presentation" @click.capture="record('capture')" @click="record('bubble')">
      <button type="button" @click="record('button')">Inside</button>
      <button type="button" @click.stop="record('stopped')">Stop here</button>
    </div>
    <button type="button" @click.once="record('once')">Only once</button>
    <button type="button" @click.stop.once="record('claimed')">Claim</button>
    <form aria-label="Note" @submit.prevent>
      <label>Note<input
        ref="field"
        name="note"
        @input="(event) => (note = (event.currentTarget as HTMLInputElement).value)"
        @keydown="(event) => event.key === 'Escape' && clearField()"
      /></label>
    </form>
    <div class="volume" role="group" aria-label="Volume" @wheel.passive="changeVolume">
      <output>{{ volume }}</output>
    </div>
    <ol aria-label="Log">
      <li v-for="(entry, index) in log" :key="index">{{ entry }}</li>
    </ol>
    <button type="button" @click="emit('logged', log)">Report</button>
    <button type="button" @click="onClick">Clear</button>
  </section>
</template>
`,
  "Effects.vue": `<script setup lang="ts">
import {
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useId,
  useTemplateRef,
  watch,
  watchPostEffect,
} from "vue";

export interface EffectsProps {
  title: string;
  interval: number;
}

const { title, interval } = defineProps<EffectsProps>();
const emit = defineEmits<{
  change: [title: string, previous?: string];
  rendered: [count: number];
  tick: [count: number];
}>();

const low = ref(10);
const high = ref(50);
const open = ref(false);
const list = useTemplateRef<HTMLUListElement>("list");
const titleId = \`uf-id-\${useId()}\`;
const tips = ["Set up your profile", "Invite your team"];
let timer: ReturnType<typeof setInterval> | undefined;
let ticks = 0;

watch(
  () => title,
  (value, previous) => {
    emit("change", value, previous);
  },
  { immediate: true },
);

watch([low, high], ([minimum, maximum], previous, onCleanup) => {
  const span = maximum - minimum;
  onCleanup(() => {
    ticks = span;
  });
});

watch(
  open,
  () => {
    emit("rendered", list.value?.childElementCount ?? 0);
  },
  { flush: "post" },
);

watchPostEffect((onCleanup) => {
  const span = high.value - low.value;
  onCleanup(() => {
    ticks = span;
  });
});

function tick() {
  ticks += 1;
  emit("tick", ticks);
}

async function toggle() {
  open.value = !open.value;
  await nextTick();
  emit("rendered", list.value?.childElementCount ?? 0);
}

onMounted(() => {
  timer = setInterval(tick, interval);
});

onUnmounted(() => {
  clearInterval(timer);
});
</script>

<template>
  <section :aria-labelledby="titleId">
    <h2 :id="titleId">{{ title }}</h2>
    <p>{{ low }} to {{ high }}</p>
    <button type="button" :aria-expanded="open" @click="toggle">Tips</button>
    <ul v-if="open" ref="list">
      <li v-for="tip in tips" :key="tip">{{ tip }}</li>
    </ul>
    <button type="button" @click="high += 10">Widen</button>
  </section>
</template>
`,
  "Silent.vue": `<script setup lang="ts">
defineEmits<{ ready: [] }>();
</script>

<template>
  <p>Silent</p>
</template>
`,
};
