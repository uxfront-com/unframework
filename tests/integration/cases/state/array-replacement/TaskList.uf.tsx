import { ref } from "unframework";

export interface Task {
  id: string;
  label: string;
}

export interface TaskListProps {
  initial: Task[];
}

export default function TaskList({ initial }: TaskListProps) {
  const tasks = ref(initial);
  const selected = ref<string>();
  let added = 0;

  function add() {
    added += 1;
    tasks.value = [...tasks.value, { id: `new-${added}`, label: `New task ${added}` }];
  }

  function select(id: string) {
    selected.value = id;
  }

  function remove(id: string) {
    tasks.value = tasks.value.filter((entry) => entry.id !== id);
  }

  function moveUp() {
    const index = tasks.value.findIndex((entry) => entry.id === selected.value);
    const above = tasks.value[index - 1];
    const current = tasks.value[index];
    if (index > 0 && above && current) {
      tasks.value = tasks.value.toSpliced(index - 1, 2, current, above);
    }
  }

  return (
    <section class="task-list" aria-label="Tasks">
      {tasks.value.length === 0 ? (
        <p>No tasks yet.</p>
      ) : (
        <ul>
          {tasks.value.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                aria-pressed={selected.value === task.id}
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
          ))}
        </ul>
      )}
      <button type="button" onClick={add}>
        Add task
      </button>
      <button type="button" onClick={moveUp}>
        Move up
      </button>
    </section>
  );
}
