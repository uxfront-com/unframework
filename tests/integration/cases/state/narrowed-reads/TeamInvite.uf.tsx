import { computed, defineEmits, onUnmounted, ref } from "unframework";

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

export default function TeamInvite({ inviter, members }: TeamInviteProps) {
  const emit = defineEmits<{
    select: [member: Member];
    removed: [name: string];
    submitted: [email: string];
    tagged: [count: number];
    moved: [page: number];
  }>();

  const greeting = computed(() => (inviter ? `Invite as ${inviter.name}` : "Invite as a guest"));
  const selected = ref<Member | null>(null);
  const draft = ref<Draft>({ tags: null });
  const page = ref(1);
  const pageCount = computed(() => Math.ceil(members.length / 2));
  const visible = computed(() => members.slice((page.value - 1) * 2, page.value * 2));
  const byPassword = ref(true);
  const seconds = ref(0);
  const timer = ref<ReturnType<typeof setInterval>>();

  function pick(member: Member) {
    selected.value = member;
  }

  function invite() {
    if (selected.value) emit("select", selected.value);
  }

  function remove() {
    if (!selected.value) return;
    const member = selected.value;
    selected.value = null;
    emit("removed", member.name);
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!draft.value.email) return;
    emit("submitted", draft.value.email);
  }

  function tag() {
    if (draft.value.tags) {
      draft.value = { ...draft.value, tags: [...draft.value.tags, "team"] };
    } else {
      draft.value = { ...draft.value, tags: ["team"] };
    }
    if (draft.value.tags) emit("tagged", draft.value.tags.length);
  }

  function start() {
    clearInterval(timer.value);
    timer.value = setInterval(() => {
      seconds.value += 1;
    }, 1000);
  }

  function stop() {
    clearInterval(timer.value);
    timer.value = undefined;
  }

  onUnmounted(() => {
    clearInterval(timer.value);
  });

  return (
    <section class="team-invite" aria-label="Invite">
      <h2>{greeting.value}</h2>
      <ul aria-label="Members">
        {visible.value.map((member) => (
          <li key={member.id}>
            <button
              type="button"
              aria-pressed={selected.value !== null && selected.value.id === member.id}
              onClick={() => pick(member)}
            >
              {member.name}
            </button>
          </li>
        ))}
      </ul>
      <div class="pager" role="group" aria-label="Pages">
        {page.value > 1 && (
          <button
            type="button"
            onClick={() => {
              page.value -= 1;
              emit("moved", page.value);
            }}
          >
            Previous
          </button>
        )}
        <span>
          Page {page.value} of {pageCount.value}
        </span>
        {page.value < pageCount.value && (
          <button
            type="button"
            onClick={() => {
              page.value += 1;
              emit("moved", page.value);
            }}
          >
            Next
          </button>
        )}
      </div>
      <p role="status">{selected.value ? `Selected: ${selected.value.name}` : "Nobody selected"}</p>
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
              (draft.value = {
                ...draft.value,
                email: (event.currentTarget as HTMLInputElement).value,
              })
            }
          />
        </label>
        <button type="submit">Send</button>
      </form>
      <button type="button" onClick={tag}>
        Tag as team
      </button>
      <button type="button" onClick={() => (byPassword.value = !byPassword.value)}>
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
      <button type="button" onClick={start}>
        Start the clock
      </button>
      <button type="button" onClick={stop}>
        Stop the clock
      </button>
      <p>Seconds: {seconds.value}</p>
    </section>
  );
}
