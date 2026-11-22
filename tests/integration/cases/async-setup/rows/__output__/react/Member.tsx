import { SetupPending } from "./_unframework/SetupPending";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { loadUser } from "./api";
import { type CSSProperties, Suspense, use, useState } from "react";

export interface MemberAttributes {
  className?: string;
  style?: CSSProperties;
}

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
  setup,
  settled: _settled,
  ...attributes
}: { id: string } & MemberAttributes & {
    setup: ReturnType<typeof memberSetup>;
    settled: boolean;
  }) {
  const { user } = use(setup);

  return (
    <li className={cx("member", className)} style={style} {...scopeAttributes(attributes)}>
      {user.name}
    </li>
  );
}
