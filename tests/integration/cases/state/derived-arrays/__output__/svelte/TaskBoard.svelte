<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";

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

  let { initial }: TaskBoardProps = $props();

  let tasks = $state.raw(untrack(() => initial));
  let filters = $state.raw<Filters>({ query: "", tags: [] });
  let notes: HTMLTextAreaElement | null = null;
  const open = $derived(tasks.filter((task) => !task.done).sort((a, b) => a.rank - b.rank));
  const alphabetical = $derived(
    tasks.slice().sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0)),
  );
  const newestFirst = $derived(tasks.map((task) => task.title).reverse());

  const kinds = $derived.by(() => {
    const byKind: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (!byKind[task.kind]) byKind[task.kind] = [];
      byKind[task.kind]!.push(task);
    }
    return Object.keys(byKind).map((kind) => `${kind}: ${byKind[kind]!.length}`);
  });

  const byId = $derived(
    tasks.reduce<Record<number, Task>>((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {}),
  );

  const titlesByKind = $derived(
    tasks.reduce<Record<string, string[]>>((acc, task) => {
      (acc[task.kind] ||= []).push(task.title);
      return acc;
    }, {}),
  );

  const finishedByKind = $derived(
    tasks.reduce((acc, task) => {
      if (task.done) acc.set(task.kind, (acc.get(task.kind) ?? 0) + 1);
      return acc;
    }, new Map<string, number>()),
  );

  const byState = $derived.by(() => {
    const groups: Record<string, string[]> = {};
    for (const task of tasks) {
      const state = task.done ? "done" : "open";
      groups[state] ??= [];
      groups[state]!.push(task.title);
    }
    return groups;
  });

  const progress = $derived(
    Math.round((tasks.filter((task) => task.done).length / tasks.length) * 100),
  );

  function finish(id: number) {
    tasks = tasks.map((task) => (task.id === id ? { ...task, done: true } : task));
  }

  function addTag(tag: string) {
    const next = { ...filters, tags: [...filters.tags] };
    next.tags.push(tag);
    filters = next;
  }

  function resize() {
    const field = notes;
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

<section class="task-board" aria-label="Tasks">
  <ol aria-label="Open">
    {#each open as task (task.id)}
      <li
        class={{ first: task.rank === 1 }}
      >{task.title}<button
        type="button"
        onclick={() => finish(task.id)}
      >{`Finish ${task.title}`}</button></li>
    {/each}
  </ol
  ><div class="meter" role="presentation">
    <div class="fill" style:width={`${progress}%`}></div>
  </div
  ><p>Alphabetical: {alphabetical.map((task) => task.title).join(", ")}</p
  ><p>Newest first: {newestFirst.join(", ")}</p
  ><ul aria-label="Kinds">
    {#each kinds as line (line)}
      <li>{line}</li>
    {/each}
  </ul
  ><p>Task 2: {byId[2]?.title}</p
  ><p>Code tasks: {titlesByKind["code"]?.join(", ")}</p
  ><p>Finished code tasks: {finishedByKind.get("code") ?? 0}</p
  ><p>Done: {byState["done"]?.join(", ") ?? "nothing"}</p
  ><button type="button" onclick={() => addTag("urgent")}>Tag urgent</button
  ><button type="button" onclick={() => addTag("later")}>Tag later</button
  ><p>Tags: {filters.tags.join(", ")}</p
  ><label>Notes<textarea bind:this={notes} name="notes" class="notes" oninput={resize}></textarea></label
  ><label>Summary<textarea name="summary" class="summary" oninput={sizeSummary}></textarea></label>
</section>
