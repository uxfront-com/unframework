import { loadUser } from "./api";
import { type CSSProperties, Suspense, use, useEffect, useRef, useState } from "react";

export interface ProfileAttributes {
  className?: string;
  style?: CSSProperties;
}

async function profileSetup({ id }: { id: string }) {
  const user = await loadUser(id);
  return { user };
}

export default function Profile(props: { id: string } & ProfileAttributes) {
  const [setup] = useState(() => profileSetup(props));
  const [settled, setSettled] = useState(false);

  return (
    <Suspense fallback={<SetupPending setup={setup} onSettled={setSettled} />}>
      <ProfileResolved {...props} setup={setup} settled={settled} />
    </Suspense>
  );
}

function ProfileResolved({
  className,
  style,
  setup,
  settled: _settled,
  ...attributes
}: { id: string } & ProfileAttributes & {
    setup: ReturnType<typeof profileSetup>;
    settled: boolean;
  }) {
  const { user } = use(setup);

  const [visits, setVisits] = useState(user.visits);
  const visitsRef = useRef(visits);

  return (
    <p className={cx("profile", className)} style={style} {...scopeAttributes(attributes)}>
      {user.name}{" "}
      <button
        type="button"
        onClick={() => {
          visitsRef.current++;
          setVisits(visitsRef.current);
        }}
      >
        Visits: {visits}
      </button>
    </p>
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
