import {
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";

export interface ImportQueueProps {
  files: string[];
}

export interface ImportQueueEvents {
  onProgress?: (status: string, attempts: number) => void;
}

export interface ImportQueueAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ImportQueue({
  files,
  onProgress,
  className,
  style,
  ...attributes
}: ImportQueueProps & ImportQueueEvents & ImportQueueAttributes) {
  const filesRef = useRef(files);
  useLayoutEffect(() => {
    filesRef.current = files;
  });

  const nextTick = useNextTick();
  const [status, setStatus] = useState("idle");
  const statusRef = useRef(status);
  const [attempts, setAttempts] = useState(0);
  const attemptsRef = useRef(attempts);

  const previousStatusAttempts = useRef<[typeof status, typeof attempts]>([status, attempts]);
  const onStatusAttemptsChange = useEffectEvent(
    ([nextStatus, nextAttempts]: [typeof status, typeof attempts]) => {
      onProgress?.(nextStatus, nextAttempts);
    },
  );
  useEffect(() => {
    const previous = previousStatusAttempts.current;
    if (Object.is(previous[0], status) && Object.is(previous[1], attempts)) return;
    previousStatusAttempts.current = [status, attempts];
    onStatusAttemptsChange([status, attempts]);
  }, [status, attempts]);

  async function importAll() {
    statusRef.current = "starting";
    setStatus(statusRef.current);
    for (const file of filesRef.current) {
      attemptsRef.current += 1;
      setAttempts(attemptsRef.current);
      await nextTick();
      statusRef.current = `imported ${file}`;
      setStatus(statusRef.current);
    }
    statusRef.current = "done";
    setStatus(statusRef.current);
  }

  return (
    <section
      className={cx("import-queue", className)}
      aria-label="Import"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <button type="button" onClick={importAll}>
        Import all
      </button>
      <p role="status">
        {status}, {attempts} attempts
      </p>
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

/**
 * Vue's `nextTick` for one component: the promise resolves once React has rendered the writes
 * made before it and run their effects, and `settled` says nothing they wrote waits to render;
 * in the task of a click or a key that wrote, as on Vue. It resolves when the component unmounts
 * too.
 */
function useNextTick(settled: () => boolean = () => true): () => Promise<void> {
  const pending = useRef<{ ticket: number; resolve: () => void }[]>([]);
  const tickets = useRef(0);
  const mounted = useRef(false);
  const [rendered, render] = useReducer(
    (last: number, ticket: number) => Math.max(last, ticket),
    0,
  );
  useEffect(() => {
    if (!pending.current.length) return;
    // Once every effect of the commit has run.
    queueMicrotask(() => {
      if (!settled()) {
        // What the component's effects wrote has yet to render, and may end where it was, when
        // React commits nothing: a render of its own makes the next look certain.
        tickets.current += 1;
        render(tickets.current);
        return;
      }
      const due = pending.current.filter(({ ticket }) => ticket <= rendered);
      pending.current = pending.current.filter(({ ticket }) => ticket > rendered);
      for (const { resolve } of due) resolve();
    });
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (mounted.current) return;
        const due = pending.current;
        pending.current = [];
        for (const { resolve } of due) resolve();
      });
    };
  }, []);
  return () =>
    new Promise<void>((resolve) => {
      tickets.current += 1;
      const ticket = tickets.current;
      pending.current.push({ ticket, resolve });
      render(ticket);
    });
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
