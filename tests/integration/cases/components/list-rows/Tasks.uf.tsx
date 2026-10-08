import { ref } from "unframework";

import Row from "./Row.uf.tsx";

export interface Task {
  id: number;
  name: string;
  done: boolean;
}

export default function Tasks({ initial }: { initial: Task[] }) {
  const tasks = ref(initial);
  function add() {
    tasks.value = [
      ...tasks.value,
      { id: tasks.value.length + 1, name: "Water plants", done: false },
    ];
  }
  function finish(id: number) {
    tasks.value = tasks.value.map((task) => (task.id === id ? { ...task, done: true } : task));
  }
  return (
    <div>
      <div role="list" aria-label="Tasks">
        {tasks.value.map((task) => (
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
