import Row from "./Row";
import { type CSSProperties, useRef, useState } from "react";

export interface Task {
  id: number;
  name: string;
  done: boolean;
}

export interface TasksAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Tasks({
  initial,
  className,
  style,
}: { initial: Task[] } & TasksAttributes) {
  const [tasks, setTasks] = useState(initial);
  const tasksRef = useRef(tasks);

  function add() {
    tasksRef.current = [
      ...tasksRef.current,
      { id: tasksRef.current.length + 1, name: "Water plants", done: false },
    ];
    setTasks(tasksRef.current);
  }

  function finish(id: number) {
    tasksRef.current = tasksRef.current.map((task) =>
      task.id === id ? { ...task, done: true } : task,
    );
    setTasks(tasksRef.current);
  }

  return (
    <div className={className} style={style}>
      <div role="list" aria-label="Tasks">
        {tasks.map((task) => (
          <Row key={task.id} name={task.name} done={task.done} />
        ))}
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
