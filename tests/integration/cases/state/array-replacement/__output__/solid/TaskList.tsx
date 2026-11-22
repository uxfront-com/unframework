import {
  type ComponentProps,
  For,
  type JSX,
  Show,
  createMemo,
  createSignal,
  splitProps,
  untrack,
} from "solid-js";

export interface Task {
  id: string;
  label: string;
}

export interface TaskListProps {
  initial: Task[];
}

export default function TaskList(
  props: TaskListProps &
    Omit<ComponentProps<"section">, "initial" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["initial", "class"]);

  const [tasks, setTasks] = createSignal(untrack(() => props.initial));
  const [selected, setSelected] = createSignal<string>();
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
                    aria-pressed={selected() === task.value.id}
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
