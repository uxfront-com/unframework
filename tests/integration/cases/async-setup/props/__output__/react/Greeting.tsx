import { loadUser } from "./api";
import { type ComponentPropsWithRef, Suspense, use, useEffect, useState } from "react";

export type GreetingAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "id" | "prefix" | "children"
>;

async function greetingSetup({ id, prefix }: { id: string; prefix: string }) {
  const user = await loadUser(prefix + id);
  return { user };
}

export default function Greeting(props: { id: string; prefix: string } & GreetingAttributes) {
  const [setup] = useState(() => greetingSetup(props));
  const [settled, setSettled] = useState(false);

  return (
    <Suspense fallback={<SetupPending setup={setup} onSettled={setSettled} />}>
      <GreetingResolved {...props} setup={setup} settled={settled} />
    </Suspense>
  );
}

function GreetingResolved({
  id,
  className,
  style,
  prefix: _prefix,
  setup,
  settled: _settled,
  ...attributes
}: { id: string; prefix: string } & GreetingAttributes & {
    setup: ReturnType<typeof greetingSetup>;
    settled: boolean;
  }) {
  const { user } = use(setup);

  return (
    <section
      className={cx("greeting", className)}
      aria-label="Greeting"
      style={style}
      {...attributes}
    >
      <h2>Hello, {user.name}</h2>
      <p>Signed in as {id}</p>
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
