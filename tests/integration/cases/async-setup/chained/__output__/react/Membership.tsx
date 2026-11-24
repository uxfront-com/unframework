import { SetupPending } from "./_unframework/SetupPending";
import { cx } from "./_unframework/cx";
import { loadTeam, loadUser } from "./api";
import { type ComponentPropsWithRef, Suspense, use, useMemo, useState } from "react";

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
