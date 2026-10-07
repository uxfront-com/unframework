import { For, Show, createSignal, untrack } from "solid-js";

export interface Task {
  id: string;
  label: string;
}

export interface TaskListProps {
  initial: Task[];
}

export default function TaskList(props: TaskListProps) {
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
    <section class="task-list" aria-label="Tasks">
      <Show
        when={tasks().length === 0}
        fallback={
          <ul>
            <For each={tasks()}>
              {(task) => (
                <li>
                  <button
                    type="button"
                    aria-pressed={selected() === task.id}
                    onClick={() => select(task.id)}
                  >
                    {task.label}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${task.label}`}
                    onClick={() => remove(task.id)}
                  >
                    Remove
                  </button>
                </li>
              )}
            </For>
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
