import { For, Show, createMemo, createSignal } from "solid-js";

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

export default function MeetingList(props: MeetingListProps & MeetingListEvents) {
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
    <section class="meeting-list" aria-label="Meetings">
      <ul aria-label="Upcoming">
        <For each={upcoming()}>
          {(event) => (
            <li>
              <button
                type="button"
                ref={(element) => {
                  element.addEventListener("click", () => show(event));
                  element.addEventListener("click", () => props.onOpened?.(event.title), {
                    once: true,
                  });
                }}
              >
                {event.title}
              </button>
            </li>
          )}
        </For>
      </ul>
      <ul aria-label="Rooms">
        <For each={rooms()}>
          {(room) => (
            <li>
              <button
                type="button"
                ref={(element) => {
                  element.addEventListener("click", () => record(`pick ${room}`));
                  element.addEventListener("click", async () => book(room), { once: true });
                }}
              >
                {room}
              </button>
            </li>
          )}
        </For>
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
        <For each={log()}>{(line) => <li>{line}</li>}</For>
      </ol>
    </section>
  );
}
