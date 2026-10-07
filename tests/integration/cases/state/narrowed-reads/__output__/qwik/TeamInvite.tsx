import { $, type QRL, component$, useComputed$, useSignal, useVisibleTask$ } from "@qwik.dev/core";

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
  onSelect$?: QRL<(member: Member) => void>;
  onRemoved$?: QRL<(name: string) => void>;
  onSubmitted$?: QRL<(email: string) => void>;
  onTagged$?: QRL<(count: number) => void>;
  onMoved$?: QRL<(page: number) => void>;
}

export default component$<TeamInviteProps & TeamInviteEvents>(
  ({ inviter, members, onSelect$, onRemoved$, onSubmitted$, onTagged$, onMoved$ }) => {
    const greeting = useComputed$(() =>
      inviter ? `Invite as ${inviter.name}` : "Invite as a guest",
    );
    const selected = useSignal<Member | null>(null);
    const draft = useSignal<Draft>({ tags: null });
    const page = useSignal(1);
    const pageCount = useComputed$(() => Math.ceil(members.length / 2));
    const visible = useComputed$(() => members.slice((page.value - 1) * 2, page.value * 2));
    const byPassword = useSignal(true);
    const seconds = useSignal(0);
    const timer = useSignal<ReturnType<typeof setInterval>>();

    const pick = $((member: Member) => {
      selected.value = member;
    });

    const invite = $(() => {
      if (selected.value) onSelect$?.(selected.value);
    });

    const remove = $(() => {
      if (!selected.value) return;
      const member = selected.value;
      selected.value = null;
      onRemoved$?.(member.name);
    });

    const submit = $(() => {
      if (!draft.value.email) return;
      onSubmitted$?.(draft.value.email);
    });

    const tag = $(() => {
      if (draft.value.tags) {
        draft.value = { ...draft.value, tags: [...draft.value.tags, "team"] };
      } else {
        draft.value = { ...draft.value, tags: ["team"] };
      }
      if (draft.value.tags) onTagged$?.(draft.value.tags.length);
    });

    const start = $(() => {
      clearInterval(timer.value);
      timer.value = setInterval(() => {
        seconds.value += 1;
      }, 1000);
    });

    const stop = $(() => {
      clearInterval(timer.value);
      timer.value = undefined;
    });

    useVisibleTask$(
      ({ cleanup }) => {
        cleanup(() => {
          clearInterval(timer.value);
        });
      },
      { strategy: "document-ready" },
    );

    return (
      <section class="team-invite" aria-label="Invite">
        <h2>{greeting.value}</h2>
        <ul aria-label="Members">
          {visible.value.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                aria-pressed={selected.value !== null && selected.value.id === member.id}
                onClick$={() => pick(member)}
              >
                {member.name}
              </button>
            </li>
          ))}
        </ul>
        <div class="pager" role="group" aria-label="Pages">
          {page.value > 1 ? (
            <button
              type="button"
              onClick$={() => {
                page.value -= 1;
                onMoved$?.(page.value);
              }}
            >
              Previous
            </button>
          ) : null}
          <span>
            Page {page.value} of {pageCount.value}
          </span>
          {page.value < pageCount.value ? (
            <button
              type="button"
              onClick$={() => {
                page.value += 1;
                onMoved$?.(page.value);
              }}
            >
              Next
            </button>
          ) : null}
        </div>
        <p role="status">
          {selected.value ? `Selected: ${selected.value.name}` : "Nobody selected"}
        </p>
        <button type="button" onClick$={invite}>
          Invite
        </button>
        <button type="button" onClick$={remove}>
          Remove
        </button>
        <form aria-label="Email invite" preventdefault:submit onSubmit$={submit}>
          <label>
            Email
            <input
              type="email"
              name="email"
              onInput$={(_, element) =>
                (draft.value = { ...draft.value, email: (element as HTMLInputElement).value })
              }
            />
          </label>
          <button type="submit">Send</button>
        </form>
        <button type="button" onClick$={tag}>
          Tag as team
        </button>
        <button type="button" onClick$={() => (byPassword.value = !byPassword.value)}>
          {byPassword.value ? "Use a link" : "Use a password"}
        </button>
        <div class="field">
          {byPassword.value ? (
            <input type="password" aria-label="Password" />
          ) : (
            <>
              <input type="text" aria-label="Sign-in email" />
              <small>We send you a link.</small>
            </>
          )}
        </div>
        <button type="button" onClick$={start}>
          Start the clock
        </button>
        <button type="button" onClick$={stop}>
          Stop the clock
        </button>
        <p>Seconds: {seconds.value}</p>
      </section>
    );
  },
);
