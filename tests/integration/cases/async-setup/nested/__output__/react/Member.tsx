import { SetupPending } from "./_unframework/SetupPending";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { loadUser } from "./api";
import {
  type CSSProperties,
  type Ref,
  Suspense,
  use,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface MemberHandle {
  reset(): void;
}

export interface MemberAttributes {
  className?: string;
  style?: CSSProperties;
  ref?: Ref<MemberHandle>;
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
  ref,
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
    <article className={cx("member", className)} style={style} {...scopeAttributes(attributes)}>
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
