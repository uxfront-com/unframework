import Row from "./Row";
import { type Accessor, For, type JSX, createMemo, createSignal, untrack } from "solid-js";

export interface Task {
  id: number;
  name: string;
  done: boolean;
}

export default function Tasks(
  props: { initial: Task[] } & { class?: string; style?: JSX.CSSProperties },
) {
  const [tasks, setTasks] = createSignal(untrack(() => props.initial));

  function add() {
    setTasks([...tasks(), { id: tasks().length + 1, name: "Water plants", done: false }]);
  }

  function finish(id: number) {
    setTasks(tasks().map((task) => (task.id === id ? { ...task, done: true } : task)));
  }

  return (
    <div class={props.class} style={props.style} {...scopeAttributes(props)}>
      <div role="list" aria-label="Tasks">
        <KeyedFor each={tasks()} by={(task) => task.id}>
          {(task) => <Row name={task().name} done={task().done} />}
        </KeyedFor>
      </div>
      <button type="button" onClick={add}>
        Add a task
      </button>
      <button type="button" onClick={() => finish(1)}>
        Finish the first
      </button>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element;
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
        return untrack(() => props.children(item, index));
      }}
    </For>
  );
}
