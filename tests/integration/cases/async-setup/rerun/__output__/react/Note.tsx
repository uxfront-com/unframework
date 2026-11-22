import { loadUser } from "./api";
import {
  type ComponentPropsWithRef,
  Suspense,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

export interface NoteEvents {
  onReady?: (name: string) => void;
}

export type NoteAttributes = Omit<ComponentPropsWithRef<"form">, "id" | "onReady" | "children">;

async function noteSetup({ id }: { id: string }) {
  const user = await loadUser(id);
  return { user };
}

export default function Note(props: { id: string } & NoteEvents & NoteAttributes) {
  const [setup] = useState(() => noteSetup(props));
  const [settled, setSettled] = useState(false);

  return (
    <Suspense fallback={<SetupPending setup={setup} onSettled={setSettled} />}>
      <NoteResolved {...props} setup={setup} settled={settled} />
    </Suspense>
  );
}

function NoteResolved({
  onReady,
  className,
  style,
  id: _id,
  setup,
  settled: _settled,
  ...attributes
}: { id: string } & NoteEvents &
  NoteAttributes & { setup: ReturnType<typeof noteSetup>; settled: boolean }) {
  const { user } = use(setup);

  const input = useRef<HTMLInputElement>(null);

  const onMount = useEffectEvent(() => {
    input.current?.focus();
    onReady?.(user.name);
  });
  useEffect(() => {
    onMount();
  }, []);

  return (
    <form className={cx("note", className)} aria-label="Note" style={style} {...attributes}>
      <label>
        Note for {user.name} <input ref={input} type="text" />
      </label>
    </form>
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
 * Renders nothing while a setup runs, and tells the component once it settles, so React shows the
 * content at once rather than after its fallback throttle. Only a fallback React commits runs it:
 * never on the server, and never while the client hydrates.
 */
function SetupPending({
  setup,
  onSettled,
}: {
  setup: Promise<unknown>;
  onSettled: (settled: boolean) => void;
}): null {
  useEffect(() => {
    let live = true;
    const settle = () => {
      if (live) onSettled(true);
    };
    setup.then(settle, settle);
    return () => {
      live = false;
    };
  }, [setup, onSettled]);
  return null;
}
