import Row from "./Row";
import { $, type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export interface Task {
  id: number;
  name: string;
  done: boolean;
}

export default component$<{ initial: Task[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ initial, class: className, style, ...attributes }) => {
    const tasks = useSignal(initial);

    const add = $(() => {
      tasks.value = [
        ...tasks.value,
        { id: tasks.value.length + 1, name: "Water plants", done: false },
      ];
    });

    const finish = $((id: number) => {
      tasks.value = tasks.value.map((task) => (task.id === id ? { ...task, done: true } : task));
    });

    return (
      <div {...scopeAttributes(attributes)} class={className} style={style}>
        <div role="list" aria-label="Tasks">
          {tasks.value.map((task) => (
            <Row key={task.id} name={task.name} done={task.done} />
          ))}
        </div>
        <button type="button" onClick$={add}>
          Add a task
        </button>
        <button type="button" onClick$={() => finish(1)}>
          Finish the first
        </button>
      </div>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
