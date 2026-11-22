import { loadTeam, loadUser } from "./api";
import { type ComponentPropsWithRef, Suspense, use, useEffect, useMemo, useState } from "react";

export type MembershipAttributes = Omit<ComponentPropsWithRef<"p">, "id" | "children">;

async function membershipSetup({ id }: { id: string }) {
  const user = await loadUser(id);
  const team = await loadTeam(user.teamId);
  return { user, team };
}

export default function Membership(props: { id: string } & MembershipAttributes) {
  const [setup] = useState(() => membershipSetup(props));
  const [settled, setSettled] = useState(false);

  return (
    <Suspense fallback={<SetupPending setup={setup} onSettled={setSettled} />}>
      <MembershipResolved {...props} setup={setup} settled={settled} />
    </Suspense>
  );
}

function MembershipResolved({
  className,
  style,
  id: _id,
  setup,
  settled: _settled,
  ...attributes
}: { id: string } & MembershipAttributes & {
    setup: ReturnType<typeof membershipSetup>;
    settled: boolean;
  }) {
  const { user, team } = use(setup);

  const summary = useMemo(() => `${user.name} is in ${team.name}`, [user, team]);

  return (
    <p className={cx("membership", className)} role="status" style={style} {...attributes}>
      {summary}
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
