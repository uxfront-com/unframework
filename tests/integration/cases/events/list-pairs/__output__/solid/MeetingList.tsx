import { KeyedFor } from "./_unframework/KeyedFor";
import {
  type ComponentProps,
  type JSX,
  Show,
  createMemo,
  createSignal,
  splitProps,
} from "solid-js";

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
  props: MeetingListProps &
    MeetingListEvents &
    Omit<ComponentProps<"section">, "meetings" | "organiser" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, [
    "meetings",
    "organiser",
    "onOpened",
    "onThanked",
    "onTrack",
    "class",
  ]);

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
      {...others}
    >
      <ul aria-label="Upcoming">
        <KeyedFor each={upcoming()} by={(event) => event.id}>
          {(event) => (
            <li>
              <button
                type="button"
                ref={(element) => {
                  element.addEventListener("click", () => show(event.value));
                  element.addEventListener("click", () => props.onOpened?.(event.value.title), {
                    once: true,
                  });
                }}
              >
                {event.value.title}
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
                  element.addEventListener("click", () => record(`pick ${room.value}`));
                  element.addEventListener("click", async () => book(room.value), { once: true });
                }}
              >
                {room.value}
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
          {(line) => <li>{line.value}</li>}
        </KeyedFor>
      </ol>
    </section>
  );
}
