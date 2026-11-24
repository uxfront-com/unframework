import Badge, { ToneKey } from "./Badge";
import { SetupPending } from "./_unframework/SetupPending";
import { cx } from "./_unframework/cx";
import { loadUser } from "./api";
import { type ComponentPropsWithRef, type ReactNode, Suspense, use, useState } from "react";

export interface PanelSlots {
  children?: ReactNode;
}

export type PanelAttributes = Omit<ComponentPropsWithRef<"section">, "id" | "children">;

async function panelSetup({ id }: { id: string }) {
  const user = await loadUser(id);
  return { user };
}

export default function Panel(props: { id: string } & PanelSlots & PanelAttributes) {
  const [setup] = useState(() => panelSetup(props));
  const [settled, setSettled] = useState(false);

  return (
    <Suspense fallback={<SetupPending setup={setup} onSettled={setSettled} />}>
      <PanelResolved {...props} setup={setup} settled={settled} />
    </Suspense>
  );
}

function PanelResolved({
  children,
  className,
  style,
  id: _id,
  setup,
  settled: _settled,
  ...attributes
}: { id: string } & PanelSlots &
  PanelAttributes & { setup: ReturnType<typeof panelSetup>; settled: boolean }) {
  const { user } = use(setup);

  const [toneValue] = useState("calm");

  return (
    <ToneKey value={toneValue}>
      <section
        className={cx("panel", className)}
        aria-label={user.name}
        style={style}
        {...attributes}
      >
        <Badge />
        {children}
      </section>
    </ToneKey>
  );
}
