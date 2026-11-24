import { loadUser } from "./api";
import { type ComponentPropsWithRef, Suspense, use, useEffect, useState } from "react";

export type MemberAttributes = Omit<ComponentPropsWithRef<"li">, "id" | "children">;

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
  id: _id,
  setup,
  settled: _settled,
  ...attributes
}: { id: string } & MemberAttributes & {
    setup: ReturnType<typeof memberSetup>;
    settled: boolean;
  }) {
  const { user } = use(setup);

  return (
    <li className={cx("member", className)} style={style} {...attributes}>
      {user.name}
    </li>
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
