import { SetupPending } from "./_unframework/SetupPending";
import { cx } from "./_unframework/cx";
import { loadUser } from "./api";
import { type ComponentPropsWithRef, Suspense, use, useRef, useState } from "react";

export type ProfileAttributes = Omit<ComponentPropsWithRef<"p">, "id" | "children">;

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
  id: _id,
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
    <p className={cx("profile", className)} style={style} {...attributes}>
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
