import { SetupPending } from "./_unframework/SetupPending";
import { cx } from "./_unframework/cx";
import { loadUser } from "./api";
import { type ComponentPropsWithRef, Suspense, use, useState } from "react";

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
