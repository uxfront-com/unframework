import Row from "./Row";
import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit, untrack } from "solid-js";

export interface Task {
  id: number;
  name: string;
  done: boolean;
}

export default function Tasks(
  props: { initial: Task[] } & Omit<ComponentProps<"div">, "initial" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "initial");

  const [tasks, setTasks] = createState(untrack(() => props.initial));

  function add() {
    setTasks([...tasks(), { id: tasks().length + 1, name: "Water plants", done: false }]);
  }

  function finish(id: number) {
    setTasks(tasks().map((task) => (task.id === id ? { ...task, done: true } : task)));
  }

  return (
    <div {...others}>
      <div role="list" aria-label="Tasks">
        <KeyedFor each={tasks()} by={(task) => task.id}>
          {(task) => <Row name={task.value.name} done={task.value.done} />}
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
