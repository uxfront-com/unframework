// What this target will emit for M1's constructs, written by hand before the emitter does, in the
// shapes of design §5.2: `<script setup lang="ts">` with `defineProps<P>()` destructured, with a
// default for every optional prop (`undefined` when the source has none), or `withDefaults`,
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
