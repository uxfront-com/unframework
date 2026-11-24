import { SetupPending } from "./_unframework/SetupPending";
import { cx } from "./_unframework/cx";
import { loadUser } from "./api";
import {
  type ComponentPropsWithRef,
  Suspense,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

export interface NoteEvents {
  onReady?: (name: string) => void;
}

export type NoteAttributes = Omit<ComponentPropsWithRef<"form">, "id" | "onReady" | "children">;

async function noteSetup({ id }: { id: string }) {
  const user = await loadUser(id);
  return { user };
}

export default function Note(props: { id: string } & NoteEvents & NoteAttributes) {
  const [setup] = useState(() => noteSetup(props));
  const [settled, setSettled] = useState(false);

  return (
    <Suspense fallback={<SetupPending setup={setup} onSettled={setSettled} />}>
      <NoteResolved {...props} setup={setup} settled={settled} />
    </Suspense>
  );
}

function NoteResolved({
  onReady,
  className,
  style,
  id: _id,
  setup,
  settled: _settled,
  ...attributes
}: { id: string } & NoteEvents &
  NoteAttributes & { setup: ReturnType<typeof noteSetup>; settled: boolean }) {
  const { user } = use(setup);

  const input = useRef<HTMLInputElement>(null);

  const onMount = useEffectEvent(() => {
    input.current?.focus();
    onReady?.(user.name);
  });
  useEffect(() => {
    onMount();
  }, []);

  return (
    <form className={cx("note", className)} aria-label="Note" style={style} {...attributes}>
      <label>
        Note for {user.name} <input ref={input} type="text" />
      </label>
    </form>
  );
}
