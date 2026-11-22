import Badge, { ToneKey } from "./Badge";
import { SetupPending } from "./_unframework/SetupPending";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { loadUser } from "./api";
import { type CSSProperties, type ReactNode, Suspense, use, useState } from "react";

export interface PanelSlots {
  children?: ReactNode;
}

export interface PanelAttributes {
  className?: string;
  style?: CSSProperties;
}

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
        {...scopeAttributes(attributes)}
      >
        <Badge />
        {children}
      </section>
    </ToneKey>
  );
}
