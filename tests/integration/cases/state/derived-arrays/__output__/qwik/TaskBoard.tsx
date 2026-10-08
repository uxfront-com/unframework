import { $, component$, useComputed$, useSignal } from "@qwik.dev/core";

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

function sizeSummary(event: Event, element: Element) {
  const area = element as HTMLTextAreaElement;
  const lines = area.value.split("\n").length;
  area.style.height = `${Math.max(lines, 2) * 1.5}em`;
  area.classList.toggle("tall", lines > 3);
}

export default component$<TaskBoardProps>(({ initial }) => {
  const tasks = useSignal(initial);
  const filters = useSignal<Filters>({ query: "", tags: [] });
  const notes = useSignal<HTMLTextAreaElement>();
  const open = useComputed$(() =>
    tasks.value.filter((task) => !task.done).sort((a, b) => a.rank - b.rank),
  );
  const alphabetical = useComputed$(() =>
    tasks.value.slice().sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0)),
  );
  const newestFirst = useComputed$(() => tasks.value.map((task) => task.title).reverse());
  const kinds = useComputed$(() => {
    const byKind: Record<string, Task[]> = {};
    for (const task of tasks.value) {
      if (!byKind[task.kind]) byKind[task.kind] = [];
      byKind[task.kind]!.push(task);
    }
    return Object.keys(byKind).map((kind) => `${kind}: ${byKind[kind]!.length}`);
  });
  const byId = useComputed$(() =>
    tasks.value.reduce<Record<number, Task>>((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {}),
  );
  const titlesByKind = useComputed$(() =>
    tasks.value.reduce<Record<string, string[]>>((acc, task) => {
      (acc[task.kind] ||= []).push(task.title);
      return acc;
    }, {}),
  );
  const finishedByKind = useComputed$(() =>
    tasks.value.reduce((acc, task) => {
      if (task.done) acc.set(task.kind, (acc.get(task.kind) ?? 0) + 1);
      return acc;
    }, new Map<string, number>()),
  );
  const byState = useComputed$(() => {
    const groups: Record<string, string[]> = {};
    for (const task of tasks.value) {
      const state = task.done ? "done" : "open";
      groups[state] ??= [];
      groups[state]!.push(task.title);
    }
    return groups;
  });
  const progress = useComputed$(() =>
    Math.round((tasks.value.filter((task) => task.done).length / tasks.value.length) * 100),
  );

  const finish = $((id: number) => {
    tasks.value = tasks.value.map((task) => (task.id === id ? { ...task, done: true } : task));
  });

  const addTag = $((tag: string) => {
    const next = { ...filters.value, tags: [...filters.value.tags] };
    next.tags.push(tag);
    filters.value = next;
  });

  const resize = $(() => {
    const field = notes.value ?? null;
    if (!field) return;
    const lines = field.value.split("\n").length;
    field.style.height = `${Math.max(lines, 2) * 1.5}em`;
    field.classList.toggle("tall", lines > 3);
  });

  return (
    <section class="task-board" aria-label="Tasks">
      <ol aria-label="Open">
        {open.value.map((task) => (
          <li key={task.id} class={{ first: task.rank === 1 }}>
            {task.title}
            <button type="button" onClick$={() => finish(task.id)}>{`Finish ${task.title}`}</button>
          </li>
        ))}
      </ol>
      <div class="meter" role="presentation">
        <div class="fill" style={{ width: `${progress.value}%` }} />
      </div>
      <p>Alphabetical: {alphabetical.value.map((task) => task.title).join(", ")}</p>
      <p>Newest first: {newestFirst.value.join(", ")}</p>
      <ul aria-label="Kinds">
        {kinds.value.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p>Task 2: {byId.value[2]?.title}</p>
      <p>Code tasks: {titlesByKind.value["code"]?.join(", ")}</p>
      <p>Finished code tasks: {finishedByKind.value.get("code") ?? 0}</p>
      <p>Done: {byState.value["done"]?.join(", ") ?? "nothing"}</p>
      <button type="button" onClick$={() => addTag("urgent")}>
        Tag urgent
      </button>
      <button type="button" onClick$={() => addTag("later")}>
        Tag later
      </button>
      <p>Tags: {filters.value.tags.join(", ")}</p>
      <label>
        Notes
        <textarea ref={notes} name="notes" class="notes" onInput$={resize} />
      </label>
      <label>
        Summary
        <textarea name="summary" class="summary" onInput$={$(sizeSummary)} />
      </label>
    </section>
  );
});
