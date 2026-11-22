import type { ComponentProps, JSX } from "@solidjs/web";
import { For, createMemo, createSignal, getObserver, omit, onCleanup, untrack } from "solid-js";

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

function sizeSummary(event: Event) {
  const area = event.currentTarget as HTMLTextAreaElement;
  const lines = area.value.split("\n").length;
  area.style.height = `${Math.max(lines, 2) * 1.5}em`;
  area.classList.toggle("tall", lines > 3);
}

export default function TaskBoard(
  props: TaskBoardProps &
    Omit<ComponentProps<"section">, "initial" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "initial", "class");

  const [tasks, setTasks] = createState(untrack(() => props.initial));
  const [filters, setFilters] = createState<Filters>({ query: "", tags: [] });
  let notes: HTMLTextAreaElement | null = null;
  const open = () =>
    tasks()
      .filter((task) => !task.done)
      .sort((a, b) => a.rank - b.rank);
  const alphabetical = () =>
    tasks()
      .slice()
      .sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
  const newestFirst = () =>
    tasks()
      .map((task) => task.title)
      .reverse();
  const kinds = () => {
    const byKind: Record<string, Task[]> = {};
    for (const task of tasks()) {
      if (!byKind[task.kind]) byKind[task.kind] = [];
      byKind[task.kind]!.push(task);
    }
    return Object.keys(byKind).map((kind) => `${kind}: ${byKind[kind]!.length}`);
  };
  const byId = () =>
    tasks().reduce<Record<number, Task>>((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {});
  const titlesByKind = () =>
    tasks().reduce<Record<string, string[]>>((acc, task) => {
      (acc[task.kind] ||= []).push(task.title);
      return acc;
    }, {});
  const finishedByKind = () =>
    tasks().reduce((acc, task) => {
      if (task.done) acc.set(task.kind, (acc.get(task.kind) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
  const byState = () => {
    const groups: Record<string, string[]> = {};
    for (const task of tasks()) {
      const state = task.done ? "done" : "open";
      groups[state] ??= [];
      groups[state]!.push(task.title);
    }
    return groups;
  };
  const progress = () =>
    Math.round((tasks().filter((task) => task.done).length / tasks().length) * 100);

  function finish(id: number) {
    setTasks(tasks().map((task) => (task.id === id ? { ...task, done: true } : task)));
  }

  function addTag(tag: string) {
    const next = { ...filters(), tags: [...filters().tags] };
    next.tags.push(tag);
    setFilters(next);
  }

  function resize() {
    const field = notes;
    if (!field) return;
    const lines = field.value.split("\n").length;
    field.style.height = `${Math.max(lines, 2) * 1.5}em`;
    field.classList.toggle("tall", lines > 3);
  }

  return (
    <section
      class={props.class ? `task-board ${props.class}` : "task-board"}
      aria-label="Tasks"
      {...others}
    >
      <ol aria-label="Open">
        <KeyedFor each={open()} by={(task) => task.id}>
          {(task) => (
            <li class={{ first: task.value.rank === 1 }}>
              {task.value.title}
              <button
                type="button"
                onClick={() => finish(task.value.id)}
              >{`Finish ${task.value.title}`}</button>
            </li>
          )}
        </KeyedFor>
      </ol>
      <div class="meter" role="presentation">
        <div class="fill" style={{ width: `${progress()}%` }} />
      </div>
      <p>
        Alphabetical:{" "}
        {alphabetical()
          .map((task) => task.title)
          .join(", ")}
      </p>
      <p>Newest first: {newestFirst().join(", ")}</p>
      <ul aria-label="Kinds">
        <KeyedFor each={kinds()} by={(line) => line}>
          {(line) => <li>{line.value}</li>}
        </KeyedFor>
      </ul>
      <p>Task 2: {byId()[2]?.title}</p>
      <p>Code tasks: {titlesByKind()["code"]?.join(", ")}</p>
      <p>Finished code tasks: {finishedByKind().get("code") ?? 0}</p>
      <p>Done: {byState()["done"]?.join(", ") ?? "nothing"}</p>
      <button type="button" onClick={() => addTag("urgent")}>
        Tag urgent
      </button>
      <button type="button" onClick={() => addTag("later")}>
        Tag later
      </button>
      <p>Tags: {filters().tags.join(", ")}</p>
      <label>
        Notes
        <textarea
          ref={clearedRef(
            (element) => {
              notes = element;
            },
            () => {
              notes = null;
            },
          )}
          name="notes"
          class="notes"
          onInput={resize}
        />
      </label>
      <label>
        Summary
        <textarea name="summary" class="summary" onInput={sizeSummary} />
      </label>
    </section>
  );
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}

/** A `ref` that calls `callback` with its element, and `clear` once the element is removed. */
function clearedRef<T>(callback: (element: T) => void, clear: () => void): (element: T) => void {
  onCleanup(clear);
  return callback;
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
