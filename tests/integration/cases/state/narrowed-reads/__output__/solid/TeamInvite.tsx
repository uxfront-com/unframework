import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";

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

export default function TeamInvite(props: TeamInviteProps & TeamInviteEvents) {
  const greeting = createMemo(() =>
    props.inviter ? `Invite as ${props.inviter.name}` : "Invite as a guest",
  );
  const [selected, setSelected] = createSignal<Member | null>(null);
  const [draft, setDraft] = createSignal<Draft>({ tags: null });
  const [page, setPage] = createSignal(1);
  const pageCount = createMemo(() => Math.ceil(props.members.length / 2));
  const visible = createMemo(() => props.members.slice((page() - 1) * 2, page() * 2));
  const [byPassword, setByPassword] = createSignal(true);
  const [seconds, setSeconds] = createSignal(0);
  const [timer, setTimer] = createSignal<ReturnType<typeof setInterval>>();

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

  onMount(() =>
    onCleanup(() => {
      clearInterval(timer());
    }),
  );

  return (
    <section class="team-invite" aria-label="Invite">
      <h2>{greeting()}</h2>
      <ul aria-label="Members">
        <For each={visible()}>
          {(member) => (
            <li>
              <button
                type="button"
                aria-pressed={selected() !== null && selected()!.id === member.id}
                onClick={() => pick(member)}
              >
                {member.name}
              </button>
            </li>
          )}
        </For>
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
