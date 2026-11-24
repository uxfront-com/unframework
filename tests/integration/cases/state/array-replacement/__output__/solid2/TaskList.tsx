import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit, untrack } from "solid-js";

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
