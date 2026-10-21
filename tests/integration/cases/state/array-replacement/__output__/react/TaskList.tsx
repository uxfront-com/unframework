import { type CSSProperties, useRef, useState } from "react";

export interface Task {
  id: string;
  label: string;
}

export interface TaskListProps {
  initial: Task[];
}

export interface TaskListAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function TaskList({
  initial,
  className,
  style,
  ...attributes
}: TaskListProps & TaskListAttributes) {
  const [tasks, setTasks] = useState(initial);
  const tasksRef = useRef(tasks);
  const [selected, setSelected] = useState<string>();
  const selectedRef = useRef(selected);
  const added = useRef(0);

  function add() {
    added.current += 1;
    tasksRef.current = [
      ...tasksRef.current,
      { id: `new-${added.current}`, label: `New task ${added.current}` },
    ];
    setTasks(tasksRef.current);
  }

  function select(id: string) {
    selectedRef.current = id;
    setSelected(selectedRef.current);
  }

  function remove(id: string) {
    tasksRef.current = tasksRef.current.filter((entry) => entry.id !== id);
    setTasks(tasksRef.current);
  }

  function moveUp() {
    const index = tasksRef.current.findIndex((entry) => entry.id === selectedRef.current);
    const above = tasksRef.current[index - 1];
    const current = tasksRef.current[index];
    if (index > 0 && above && current) {
      tasksRef.current = tasksRef.current.toSpliced(index - 1, 2, current, above);
      setTasks(tasksRef.current);
    }
  }

  return (
    <section
      className={cx("task-list", className)}
      aria-label="Tasks"
      style={style}
      {...scopeAttributes(attributes)}
    >
      {tasks.length === 0 ? (
        <p>No tasks yet.</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                aria-pressed={selected === task.id}
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
