import type { ComponentProps, JSX } from "@solidjs/web";
import {
  For,
  Show,
  createMemo,
  createSignal,
  getObserver,
  omit,
  onSettled,
  untrack,
} from "solid-js";

export interface Member {
  id: number;
  name: string;
}

export interface Inviter {
  name: string;
}

interface Draft {
  email?: string;
  tags: string[] | null;
}

export interface TeamInviteProps {
  inviter?: Inviter;
  members: Member[];
}

export interface TeamInviteEvents {
  onSelect?: (member: Member) => void;
  onRemoved?: (name: string) => void;
  onSubmitted?: (email: string) => void;
  onTagged?: (count: number) => void;
  onMoved?: (page: number) => void;
}

export default function TeamInvite(
  props: TeamInviteProps &
    TeamInviteEvents &
    Omit<ComponentProps<"section">, "inviter" | "members" | "onSelect" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(
    props,
    "inviter",
    "members",
    "onSelect",
    "onRemoved",
    "onSubmitted",
    "onTagged",
    "onMoved",
    "class",
  );

  const greeting = () => (props.inviter ? `Invite as ${props.inviter.name}` : "Invite as a guest");
  const [selected, setSelected] = createState<Member | null>(null);
  const [draft, setDraft] = createState<Draft>({ tags: null });
  const [page, setPage] = createState(1);
  const pageCount = () => Math.ceil(props.members.length / 2);
  const visible = () => props.members.slice((page() - 1) * 2, page() * 2);
  const [byPassword, setByPassword] = createState(true);
  const [seconds, setSeconds] = createState(0);
  const [timer, setTimer] = createState<ReturnType<typeof setInterval>>();

  function pick(member: Member) {
    setSelected(member);
  }

  function invite() {
    if (selected()) props.onSelect?.(selected()!);
  }

  function remove() {
    if (!selected()) return;
    const member = selected()!;
    setSelected(null);
    props.onRemoved?.(member.name);
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!draft().email) return;
    props.onSubmitted?.(draft().email!);
  }

  function tag() {
    if (draft().tags) {
      setDraft({ ...draft(), tags: [...draft().tags!, "team"] });
    } else {
      setDraft({ ...draft(), tags: ["team"] });
    }
    if (draft().tags) props.onTagged?.(draft().tags!.length);
  }

  function start() {
    clearInterval(timer());
    setTimer(
      setInterval(() => {
        setSeconds(seconds() + 1);
      }, 1000),
    );
  }

  function stop() {
    clearInterval(timer());
    setTimer(undefined);
  }

  onSettled(() => () => {
    clearInterval(timer());
  });

  return (
    <section
      class={props.class ? `team-invite ${props.class}` : "team-invite"}
      aria-label="Invite"
      {...others}
    >
      <h2>{greeting()}</h2>
      <ul aria-label="Members">
        <KeyedFor each={visible()} by={(member) => member.id}>
          {(member) => (
            <li>
              <button
                type="button"
                aria-pressed={enumeratedValue(
                  selected() !== null && selected()!.id === member.value.id,
                )}
                onClick={() => pick(member.value)}
              >
                {member.value.name}
              </button>
            </li>
          )}
        </KeyedFor>
      </ul>
      <div class="pager" role="group" aria-label="Pages">
        <Show when={page() > 1}>
          <button
            type="button"
            onClick={() => {
              setPage(page() - 1);
              props.onMoved?.(page());
            }}
          >
            Previous
          </button>
        </Show>
        <span>
          Page {page()} of {pageCount()}
        </span>
        <Show when={page() < pageCount()}>
          <button
            type="button"
            onClick={() => {
              setPage(page() + 1);
              props.onMoved?.(page());
            }}
          >
            Next
          </button>
        </Show>
      </div>
      <p role="status">{selected() ? `Selected: ${selected()!.name}` : "Nobody selected"}</p>
      <button type="button" onClick={invite}>
        Invite
      </button>
      <button type="button" onClick={remove}>
        Remove
      </button>
      <form aria-label="Email invite" onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            name="email"
            onInput={(event) =>
              setDraft({ ...draft(), email: (event.currentTarget as HTMLInputElement).value })
            }
          />
        </label>
        <button type="submit">Send</button>
      </form>
      <button type="button" onClick={tag}>
        Tag as team
      </button>
      <button type="button" onClick={() => setByPassword(!byPassword())}>
        {byPassword() ? "Use a link" : "Use a password"}
      </button>
      <div class="field">
        <Show
          when={byPassword()}
          fallback={
            <>
              <input type="text" aria-label="Sign-in email" />
              <small>We send you a link.</small>
            </>
          }
        >
          <input type="password" aria-label="Password" />
        </Show>
      </div>
      <button type="button" onClick={start}>
        Start the clock
      </button>
      <button type="button" onClick={stop}>
        Stop the clock
      </button>
      <p>Seconds: {seconds()}</p>
    </section>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
