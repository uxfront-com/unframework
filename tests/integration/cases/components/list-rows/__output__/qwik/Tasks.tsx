import Row from "./Row";
import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface Task {
  id: number;
  name: string;
  done: boolean;
}

export default component$<
  { initial: Task[] } & Omit<PropsOf<"div">, "initial" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ initial, class: className, style, ...attributes }) => {
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
    <div class={className} style={style} {...attributes}>
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
});
