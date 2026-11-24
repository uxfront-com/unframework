import type { ComponentProps, JSX } from "@solidjs/web";
import { For, Show, createMemo, createSignal, getObserver, omit, untrack } from "solid-js";

export interface Task {
  id: string;
  label: string;
}

export interface TaskListProps {
  initial: Task[];
}

export default function TaskList(
  props: TaskListProps &
    Omit<ComponentProps<"section">, "initial" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "initial", "class");

  const [tasks, setTasks] = createState(untrack(() => props.initial));
  const [selected, setSelected] = createState<string>();
  let added = 0;

  function add() {
    added += 1;
    setTasks([...tasks(), { id: `new-${added}`, label: `New task ${added}` }]);
  }

  function select(id: string) {
    setSelected(id);
  }

  function remove(id: string) {
    setTasks(tasks().filter((entry) => entry.id !== id));
  }

  function moveUp() {
    const index = tasks().findIndex((entry) => entry.id === selected());
    const above = tasks()[index - 1];
    const current = tasks()[index];
    if (index > 0 && above && current) {
      setTasks(tasks().toSpliced(index - 1, 2, current, above));
    }
  }

  return (
    <section
      class={props.class ? `task-list ${props.class}` : "task-list"}
      aria-label="Tasks"
      {...others}
    >
      <Show
        when={tasks().length === 0}
        fallback={
          <ul>
            <KeyedFor each={tasks()} by={(task) => task.id}>
              {(task) => (
                <li>
                  <button
                    type="button"
                    aria-pressed={enumeratedValue(selected() === task.value.id)}
                    onClick={() => select(task.value.id)}
                  >
                    {task.value.label}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${task.value.label}`}
                    onClick={() => remove(task.value.id)}
                  >
                    Remove
                  </button>
                </li>
              )}
            </KeyedFor>
          </ul>
        }
      >
        <p>No tasks yet.</p>
      </Show>
      <button type="button" onClick={add}>
        Add task
      </button>
      <button type="button" onClick={moveUp}>
        Move up
      </button>
    </section>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
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
