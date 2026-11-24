<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Task {
    id: string;
    label: string;
  }

  export interface TaskListProps {
    initial: Task[];
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "initial" | "children" | "class" | "style" | "ref"
  > &
    TaskListProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let { initial, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let tasks = $state.raw(untrack(() => initial));
  let selected = $state<string>();
  let added = 0;

  function add() {
    added += 1;
    tasks = [...tasks, { id: `new-${added}`, label: `New task ${added}` }];
  }

  function select(id: string) {
    selected = id;
  }

  function remove(id: string) {
    tasks = tasks.filter((entry) => entry.id !== id);
  }

  function moveUp() {
    const index = tasks.findIndex((entry) => entry.id === selected);
    const above = tasks[index - 1];
    const current = tasks[index];
    if (index > 0 && above && current) {
      tasks = tasks.toSpliced(index - 1, 2, current, above);
    }
  }
</script>

<section
  class={["task-list", className]}
  aria-label="Tasks"
  {style}
  bind:this={ref}
  {...attributes}
>
  {#if tasks.length === 0}
    <p>No tasks yet.</p>
  {:else}
    <ul>
      {#each tasks as task (task.id)}
        <li>
          <button
            type="button"
            aria-pressed={selected === task.id}
            onclick={() => select(task.id)}
          >{task.label}</button
          ><button
            type="button"
            aria-label={`Remove ${task.label}`}
            onclick={() => remove(task.id)}
          >Remove</button>
        </li>
      {/each}
    </ul>
  {/if}<button type="button" onclick={add}>Add task</button
  ><button type="button" onclick={moveUp}>Move up</button>
</section>
