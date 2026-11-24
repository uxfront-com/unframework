import { loadUser } from "./api";
import {
  type ComponentPropsWithoutRef,
  type Ref,
  Suspense,
  use,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface MemberHandle {
  reset(): void;
}

export type MemberAttributes = Omit<ComponentPropsWithoutRef<"article">, "id" | "children"> & {
  ref?: Ref<MemberHandle>;
};

async function memberSetup({ id }: { id: string }) {
  const user = await loadUser(id);
  return { user };
}

export default function Member(props: { id: string } & MemberAttributes) {
  const [setup] = useState(() => memberSetup(props));
  const [settled, setSettled] = useState(false);

  return (
    <Suspense fallback={<SetupPending setup={setup} onSettled={setSettled} />}>
      <MemberResolved {...props} setup={setup} settled={settled} />
    </Suspense>
  );
}

function MemberResolved({
  className,
  style,
  ref,
  id: _id,
  setup,
  settled: _settled,
  ...attributes
}: { id: string } & MemberAttributes & {
    setup: ReturnType<typeof memberSetup>;
    settled: boolean;
  }) {
  const { user } = use(setup);

  const [visits, setVisits] = useState(user.visits);
  const visitsRef = useRef(visits);

  function reset() {
    visitsRef.current = 0;
    setVisits(visitsRef.current);
  }

  useImperativeHandle(ref, () => ({ reset }));

  return (
    <article className={cx("member", className)} style={style} {...attributes}>
      <h3>{user.name}</h3>
      <button
        type="button"
        onClick={() => {
          visitsRef.current++;
          setVisits(visitsRef.current);
        }}
      >
        {user.name} visits: {visits}
      </button>
    </article>
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
