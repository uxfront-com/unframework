import { type SyntheticEvent, useMemo, useRef, useState } from "react";

export interface Task {
  id: number;
  title: string;
  kind: string;
  rank: number;
  done: boolean;
}

export interface Filters {
  query: string;
  tags: string[];
}

export interface TaskBoardProps {
  initial: Task[];
}

function sizeSummary(event: SyntheticEvent) {
  const area = event.currentTarget as HTMLTextAreaElement;
  const lines = area.value.split("\n").length;
  area.style.height = `${Math.max(lines, 2) * 1.5}em`;
  area.classList.toggle("tall", lines > 3);
}

export default function TaskBoard({ initial }: TaskBoardProps) {
  const [tasks, setTasks] = useState(initial);
  const tasksRef = useRef(tasks);
  const [filters, setFilters] = useState<Filters>({ query: "", tags: [] });
  const filtersRef = useRef(filters);
  const notes = useRef<HTMLTextAreaElement>(null);
  const open = useMemo(
    () => tasks.filter((task) => !task.done).sort((a, b) => a.rank - b.rank),
    [tasks],
  );
  const alphabetical = useMemo(
    () => tasks.slice().sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0)),
    [tasks],
  );
  const newestFirst = useMemo(() => tasks.map((task) => task.title).reverse(), [tasks]);
  const kinds = useMemo(() => {
    const byKind: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (!byKind[task.kind]) byKind[task.kind] = [];
      byKind[task.kind]!.push(task);
    }
    return Object.keys(byKind).map((kind) => `${kind}: ${byKind[kind]!.length}`);
  }, [tasks]);
  const byId = useMemo(
    () =>
      tasks.reduce<Record<number, Task>>((acc, task) => {
        acc[task.id] = task;
        return acc;
      }, {}),
    [tasks],
  );
  const titlesByKind = useMemo(
    () =>
      tasks.reduce<Record<string, string[]>>((acc, task) => {
        (acc[task.kind] = acc[task.kind] || []).push(task.title);
        return acc;
      }, {}),
    [tasks],
  );
  const finishedByKind = useMemo(
    () =>
      tasks.reduce((acc, task) => {
        if (task.done) acc.set(task.kind, (acc.get(task.kind) ?? 0) + 1);
        return acc;
      }, new Map<string, number>()),
    [tasks],
  );
  const byState = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const task of tasks) {
      const state = task.done ? "done" : "open";
      groups[state] = groups[state] ?? [];
      groups[state]!.push(task.title);
    }
    return groups;
  }, [tasks]);
  const progress = useMemo(
    () => Math.round((tasks.filter((task) => task.done).length / tasks.length) * 100),
    [tasks],
  );

  function finish(id: number) {
    tasksRef.current = tasksRef.current.map((task) =>
      task.id === id ? { ...task, done: true } : task,
    );
    setTasks(tasksRef.current);
  }

  function addTag(tag: string) {
    const next = { ...filtersRef.current, tags: [...filtersRef.current.tags] };
    next.tags.push(tag);
    filtersRef.current = next;
    setFilters(filtersRef.current);
  }

  function resize() {
    const field = notes.current;
    if (!field) return;
    const lines = field.value.split("\n").length;
    field.style.height = `${Math.max(lines, 2) * 1.5}em`;
    field.classList.toggle("tall", lines > 3);
  }

  return (
    <section className="task-board" aria-label="Tasks">
      <ol aria-label="Open">
        {open.map((task) => (
          <li key={task.id} className={cx({ first: task.rank === 1 })}>
            {task.title}
            <button type="button" onClick={() => finish(task.id)}>{`Finish ${task.title}`}</button>
          </li>
        ))}
      </ol>
      <div className="meter" role="presentation">
        <div className="fill" style={{ width: `${progress}%` }} />
      </div>
      <p>Alphabetical: {alphabetical.map((task) => task.title).join(", ")}</p>
      <p>Newest first: {newestFirst.join(", ")}</p>
      <ul aria-label="Kinds">
        {kinds.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p>Task 2: {byId[2]?.title}</p>
      <p>Code tasks: {titlesByKind["code"]?.join(", ")}</p>
      <p>Finished code tasks: {finishedByKind.get("code") ?? 0}</p>
      <p>Done: {byState["done"]?.join(", ") ?? "nothing"}</p>
      <button type="button" onClick={() => addTag("urgent")}>
        Tag urgent
      </button>
      <button type="button" onClick={() => addTag("later")}>
        Tag later
      </button>
      <p>Tags: {filters.tags.join(", ")}</p>
      <label>
        Notes
        <textarea ref={notes} name="notes" className="notes" onInput={resize} />
      </label>
      <label>
        Summary
        <textarea name="summary" className="summary" onInput={sizeSummary} />
      </label>
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
