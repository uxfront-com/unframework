import { Show, createSignal } from "solid-js";

interface User {
  name: string;
}

export interface NarrowedStateProps {
  member?: User;
}

export interface NarrowedStateEvents {
  onPicked?: (name: string) => void;
}

export default function NarrowedState(props: NarrowedStateProps & NarrowedStateEvents) {
  const [user, setUser] = createSignal<User | null>(null);
  const [draft, setDraft] = createSignal<string | null>(null);

  function pick(name: string) {
    setUser({ name });
    props.onPicked?.(name);
  }

  return (
    <div>
      <Show
        when={((user) => (user !== null ? { user } : undefined))(user())}
        fallback={<p>Nobody</p>}
      >
        {(narrowed) => <p>{narrowed().user.name}</p>}
      </Show>
      <Show when={((draft) => (draft !== null ? { draft } : undefined))(draft())}>
        {(narrowed) => <p>{narrowed().draft.toUpperCase()}</p>}
      </Show>
      <Show when={props.member}>
        {(member) => (
          <button type="button" onClick={() => pick(member().name)}>
            {member().name}
          </button>
        )}
      </Show>
      <button type="button" onClick={() => setDraft("x")}>
        Draft
      </button>
    </div>
  );
}
