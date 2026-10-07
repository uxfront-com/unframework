import { $, component$, useSignal } from "@qwik.dev/core";

export interface Task {
  id: string;
  label: string;
}

export interface TaskListProps {
  initial: Task[];
}

export default component$<TaskListProps>(({ initial }) => {
  const tasks = useSignal(initial);
  const selected = useSignal<string>();
  const added = useSignal(0);

  const add = $(() => {
    added.value += 1;
    tasks.value = [...tasks.value, { id: `new-${added.value}`, label: `New task ${added.value}` }];
  });

  const select = $((id: string) => {
    selected.value = id;
  });

  const remove = $((id: string) => {
    tasks.value = tasks.value.filter((entry) => entry.id !== id);
  });

  const moveUp = $(() => {
    const index = tasks.value.findIndex((entry) => entry.id === selected.value);
    const above = tasks.value[index - 1];
    const current = tasks.value[index];
    if (index > 0 && above && current) {
      tasks.value = tasks.value.toSpliced(index - 1, 2, current, above);
    }
  });

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
                onClick$={() => select(task.id)}
              >
                {task.label}
              </button>
              <button
                type="button"
                aria-label={`Remove ${task.label}`}
                onClick$={() => remove(task.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick$={add}>
        Add task
      </button>
      <button type="button" onClick$={moveUp}>
        Move up
      </button>
    </section>
  );
});
