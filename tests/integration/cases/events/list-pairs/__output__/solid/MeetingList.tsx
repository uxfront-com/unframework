import { type Accessor, For, type JSX, Show, createMemo, createSignal, untrack } from "solid-js";

export interface Meeting {
  id: number;
  title: string;
  done: boolean;
}

export interface Organiser {
  name: string;
}

export interface MeetingListProps {
  meetings: Meeting[];
  organiser?: Organiser;
}

export interface MeetingListEvents {
  onOpened?: (title: string) => void;
  onThanked?: (name: string) => void;
  onTrack?: (name: string, count: number) => void;
}

export default function MeetingList(
  props: MeetingListProps & MeetingListEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [rooms] = createSignal(["Atlas", "Borealis"]);
  const [log, setLog] = createSignal<string[]>([]);
  const [lastKey, setLastKey] = createSignal("none");
  const [clicks, setClicks] = createSignal(0);
  const upcoming = createMemo(() => props.meetings.filter((meeting) => !meeting.done));

  function record(line: string) {
    setLog([...log(), line]);
  }

  function show(meeting: Meeting) {
    record(`show ${meeting.title}`);
  }

  async function book(room: string) {
    await Promise.resolve();
    record(`booked ${room}`);
  }

  function remember(key: string): boolean {
    setLastKey(key);
    return key === "Enter";
  }

  return (
    <section
      class={props.class ? `meeting-list ${props.class}` : "meeting-list"}
      aria-label="Meetings"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <ul aria-label="Upcoming">
        <KeyedFor each={upcoming()} by={(event) => event.id}>
          {(event) => (
            <li>
              <button
                type="button"
                ref={(element) => {
                  element.addEventListener("click", () => show(event()));
                  element.addEventListener("click", () => props.onOpened?.(event().title), {
                    once: true,
                  });
                }}
              >
                {event().title}
              </button>
            </li>
          )}
        </KeyedFor>
      </ul>
      <ul aria-label="Rooms">
        <KeyedFor each={rooms()} by={(room) => room}>
          {(room) => (
            <li>
              <button
                type="button"
                ref={(element) => {
                  element.addEventListener("click", () => record(`pick ${room()}`));
                  element.addEventListener("click", async () => book(room()), { once: true });
                }}
              >
                {room()}
              </button>
            </li>
          )}
        </KeyedFor>
      </ul>
      <Show when={props.organiser} fallback={<p>No organiser</p>}>
        {(organiser) => (
          <button
            type="button"
            ref={(element) => {
              element.addEventListener("click", () => record(`thank ${organiser().name}`));
              element.addEventListener("click", () => props.onThanked?.(organiser().name), {
                once: true,
              });
            }}
          >{`Thank ${organiser().name}`}</button>
        )}
      </Show>
      <button
        type="button"
        ref={(element) => {
          element.addEventListener("click", () => setClicks(clicks() + 1));
          element.addEventListener(
            "click",
            () => {
              const event = "first-click";
              props.onTrack?.(event, clicks());
            },
            { once: true },
          );
        }}
      >
        Track
      </button>
      <p>Clicks: {clicks()}</p>
      <label>
        Filter
        <input
          name="filter"
          onKeyDown={(event) => {
            if (event.altKey) return false;
            return remember(event.key);
          }}
        />
      </label>
      <p>Last key: {lastKey()}</p>
      <ol aria-label="Log">
        <KeyedFor each={log()} by={(line, index) => index}>
          {(line) => <li>{line()}</li>}
        </KeyedFor>
      </ol>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element;
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
        return untrack(() => props.children(item, index));
      }}
    </For>
  );
}
