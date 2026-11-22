import Badge, { ToneKey } from "./Badge";
import { loadUser } from "./api";
import {
  type ComponentPropsWithRef,
  type ReactNode,
  Suspense,
  use,
  useEffect,
  useState,
} from "react";

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
