import { loadTeam, loadUser } from "./api";
import { type CSSProperties, Suspense, use, useEffect, useMemo, useState } from "react";

export interface MembershipAttributes {
  className?: string;
  style?: CSSProperties;
}

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
    <p
      className={cx("membership", className)}
      role="status"
      style={style}
      {...scopeAttributes(attributes)}
    >
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
