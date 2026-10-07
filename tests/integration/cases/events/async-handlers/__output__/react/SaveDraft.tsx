import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";

export interface SaveDraftEvents {
  onSaved?: (attempt: number, status: string) => void;
}

export default function SaveDraft({ onSaved }: SaveDraftEvents) {
  const onSavedRef = useRef(onSaved);
  useLayoutEffect(() => {
    onSavedRef.current = onSaved;
  });

  const nextTick = useNextTick();
  const [status, setStatus] = useState("Not saved");
  const statusRef = useRef(status);
  const [attempts, setAttempts] = useState(0);
  const attemptsRef = useRef(attempts);

  async function save() {
    statusRef.current = "Saving";
    setStatus(statusRef.current);
    attemptsRef.current += 1;
    setAttempts(attemptsRef.current);
    await Promise.resolve();
    statusRef.current = "Checking";
    setStatus(statusRef.current);
    await nextTick();
    statusRef.current = `Saved, attempt ${attemptsRef.current}`;
    setStatus(statusRef.current);
    onSavedRef.current?.(attemptsRef.current, statusRef.current);
  }

  return (
    <section className="save-draft" aria-label="Draft">
      <p role="status">{status}</p>
      <button type="button" onClick={save}>
        Save the draft
      </button>
    </section>
  );
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
