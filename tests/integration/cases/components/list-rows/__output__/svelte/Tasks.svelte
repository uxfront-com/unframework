<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Row from "./Row.svelte";
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  export interface Task {
    id: number;
    name: string;
    done: boolean;
  }

  type Props = { initial: Task[]; class?: ClassValue; style?: string };

  let { initial, class: className, style }: Props = $props();

  let tasks = $state.raw(untrack(() => initial));

  function add() {
    tasks = [...tasks, { id: tasks.length + 1, name: "Water plants", done: false }];
  }

  function finish(id: number) {
    tasks = tasks.map((task) => (task.id === id ? { ...task, done: true } : task));
  }
</script>

<div class={className} {style}>
  <div role="list" aria-label="Tasks">
    {#each tasks as task (task.id)}
      <Row name={task.name} done={task.done} />
    {/each}
  </div
  ><button type="button" onclick={add}>Add a task</button
  ><button type="button" onclick={() => finish(1)}>Finish the first</button>
</div>
