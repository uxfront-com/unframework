import Row from "./Row";
import { For, type JSX, createSignal, untrack } from "solid-js";

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
        <For each={tasks()}>{(task) => <Row name={task.name} done={task.done} />}</For>
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
