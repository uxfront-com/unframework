import {
  Fragment,
  type SubmitEvent,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

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

export default function TeamInvite({
  inviter,
  members,
  onSelect,
  onRemoved,
  onSubmitted,
  onTagged,
  onMoved,
}: TeamInviteProps & TeamInviteEvents) {
  const greeting = useMemo(
    () => (inviter ? `Invite as ${inviter.name}` : "Invite as a guest"),
    [inviter],
  );
  const [selected, setSelected] = useState<Member | null>(null);
  const selectedRef = useRef(selected);
  const [draft, setDraft] = useState<Draft>({ tags: null });
  const draftRef = useRef(draft);
  const [page, setPage] = useState(1);
  const pageRef = useRef(page);
  const pageCount = useMemo(() => Math.ceil(members.length / 2), [members]);
  const visible = useMemo(() => members.slice((page - 1) * 2, page * 2), [members, page]);
  const [byPassword, setByPassword] = useState(true);
  const byPasswordRef = useRef(byPassword);
  const [seconds, setSeconds] = useState(0);
  const secondsRef = useRef(seconds);
  const [timer, setTimer] = useState<ReturnType<typeof setInterval>>();
  const timerRef = useRef(timer);

  function pick(member: Member) {
    selectedRef.current = member;
    setSelected(selectedRef.current);
  }

  function invite() {
    if (selectedRef.current) onSelect?.(selectedRef.current);
  }

  function remove() {
    if (!selectedRef.current) return;
    const member = selectedRef.current;
    selectedRef.current = null;
    setSelected(selectedRef.current);
    onRemoved?.(member.name);
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!draftRef.current.email) return;
    onSubmitted?.(draftRef.current.email);
  }

  function tag() {
    if (draftRef.current.tags) {
      draftRef.current = { ...draftRef.current, tags: [...draftRef.current.tags, "team"] };
      setDraft(draftRef.current);
    } else {
      draftRef.current = { ...draftRef.current, tags: ["team"] };
      setDraft(draftRef.current);
    }
    if (draftRef.current.tags) onTagged?.(draftRef.current.tags.length);
  }

  function start() {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    setTimer(timerRef.current);
  }

  function stop() {
    clearInterval(timerRef.current);
    timerRef.current = undefined;
    setTimer(timerRef.current);
  }

  const onUnmount = useEffectEvent(() => {
    clearInterval(timerRef.current);
  });
  useEffect(() => () => onUnmount(), []);

  return (
    <section className="team-invite" aria-label="Invite">
      <h2>{greeting}</h2>
      <ul aria-label="Members">
        {visible.map((member) => (
          <li key={member.id}>
            <button
              type="button"
              aria-pressed={selected !== null && selected.id === member.id}
              onClick={() => pick(member)}
            >
              {member.name}
            </button>
          </li>
        ))}
      </ul>
      <div className="pager" role="group" aria-label="Pages">
        {page > 1 ? (
          <button
            type="button"
            onClick={() => {
              pageRef.current -= 1;
              setPage(pageRef.current);
              onMoved?.(pageRef.current);
            }}
          >
            Previous
          </button>
        ) : null}
        <span>
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <button
            type="button"
            onClick={() => {
              pageRef.current += 1;
              setPage(pageRef.current);
              onMoved?.(pageRef.current);
            }}
          >
            Next
          </button>
        ) : null}
      </div>
      <p role="status">{selected ? `Selected: ${selected.name}` : "Nobody selected"}</p>
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
            onInput={(event) => {
              draftRef.current = {
                ...draftRef.current,
                email: (event.currentTarget as HTMLInputElement).value,
              };
              setDraft(draftRef.current);
            }}
          />
        </label>
        <button type="submit">Send</button>
      </form>
      <button type="button" onClick={tag}>
        Tag as team
      </button>
      <button
        type="button"
        onClick={() => {
          byPasswordRef.current = !byPasswordRef.current;
          setByPassword(byPasswordRef.current);
        }}
      >
        {byPassword ? "Use a link" : "Use a password"}
      </button>
      <div className="field">
        {byPassword ? (
          <input key={0} type="password" aria-label="Password" />
        ) : (
          <Fragment key={1}>
            <input type="text" aria-label="Sign-in email" />
            <small>We send you a link.</small>
          </Fragment>
        )}
      </div>
      <button type="button" onClick={start}>
        Start the clock
      </button>
      <button type="button" onClick={stop}>
        Stop the clock
      </button>
      <p>Seconds: {seconds}</p>
    </section>
  );
}
