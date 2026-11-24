import { SetupPending } from "./_unframework/SetupPending";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { loadUser } from "./api";
import {
  type CSSProperties,
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

export interface NoteAttributes {
  className?: string;
  style?: CSSProperties;
}

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
    <form
      className={cx("note", className)}
      aria-label="Note"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <label>
        Note for {user.name} <input ref={input} type="text" />
      </label>
    </form>
  );
}
