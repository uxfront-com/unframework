import { type CSSProperties, useMemo, useRef, useState } from "react";

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

export interface MeetingListAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function MeetingList({
  meetings,
  organiser,
  onOpened,
  onThanked,
  onTrack,
  className,
  style,
  ...attributes
}: MeetingListProps & MeetingListEvents & MeetingListAttributes) {
  const [rooms] = useState(["Atlas", "Borealis"]);
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef(log);
  const [lastKey, setLastKey] = useState("none");
  const lastKeyRef = useRef(lastKey);
  const [clicks, setClicks] = useState(0);
  const clicksRef = useRef(clicks);
  const upcoming = useMemo(() => meetings.filter((meeting) => !meeting.done), [meetings]);

  function record(line: string) {
    logRef.current = [...logRef.current, line];
    setLog(logRef.current);
  }

  function show(meeting: Meeting) {
    record(`show ${meeting.title}`);
  }

  async function book(room: string) {
    await Promise.resolve();
    record(`booked ${room}`);
  }

  function remember(key: string): boolean {
    lastKeyRef.current = key;
    setLastKey(lastKeyRef.current);
    return key === "Enter";
  }

  const clickOnce = useOnce();
  const clickOnce_1 = useOnce();
  const clickOnce_2 = useOnce();
  const clickOnce_3 = useOnce();

  return (
    <section
      className={cx("meeting-list", className)}
      aria-label="Meetings"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <ul aria-label="Upcoming">
        {upcoming.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={(event_1) => {
                show(event);
                if (clickOnce(event_1)) {
                  onOpened?.(event.title);
                }
              }}
            >
              {event.title}
            </button>
          </li>
        ))}
      </ul>
      <ul aria-label="Rooms">
        {rooms.map((room) => (
          <li key={room}>
            <button
              type="button"
              onClick={(event) => {
                record(`pick ${room}`);
                if (clickOnce_1(event)) {
                  const clickListener = async () => {
                    book(room);
                  };
                  void clickListener();
                }
              }}
            >
              {room}
            </button>
          </li>
        ))}
      </ul>
      {organiser ? (
        <button
          type="button"
          onClick={(event) => {
            record(`thank ${organiser.name}`);
            if (clickOnce_2(event)) {
              onThanked?.(organiser.name);
            }
          }}
        >{`Thank ${organiser.name}`}</button>
      ) : (
        <p>No organiser</p>
      )}
      <button
        type="button"
        onClick={(event_1) => {
          clicksRef.current += 1;
          setClicks(clicksRef.current);
          if (clickOnce_3(event_1)) {
            const event = "first-click";
            onTrack?.(event, clicksRef.current);
          }
        }}
      >
        Track
      </button>
      <p>Clicks: {clicks}</p>
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
      <p>Last key: {lastKey}</p>
      <ol aria-label="Log">
        {log.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The guard of a listener that runs once per element, as `{ once: true }` makes it. */
function useOnce(): (event: { currentTarget: EventTarget | null }) => boolean {
  const fired = useRef(new WeakSet<EventTarget>());
  return (event) => {
    const target = event.currentTarget;
    if (!target || fired.current.has(target)) return false;
    fired.current.add(target);
    return true;
  };
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
