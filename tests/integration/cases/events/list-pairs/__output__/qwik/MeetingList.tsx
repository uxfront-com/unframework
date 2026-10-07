import { $, type QRL, component$, useComputed$, useSignal } from "@qwik.dev/core";

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
  onOpened$?: QRL<(title: string) => void>;
  onThanked$?: QRL<(name: string) => void>;
  onTrack$?: QRL<(name: string, count: number) => void>;
}

export default component$<MeetingListProps & MeetingListEvents>(
  ({ meetings, organiser, onOpened$, onThanked$, onTrack$ }) => {
    const rooms = useSignal(["Atlas", "Borealis"]);
    const log = useSignal<string[]>([]);
    const lastKey = useSignal("none");
    const clicks = useSignal(0);
    const upcoming = useComputed$(() => meetings.filter((meeting) => !meeting.done));

    const record = $((line: string) => {
      log.value = [...log.value, line];
    });

    const book = $(async (room: string) => {
      await Promise.resolve();
      await record(`booked ${room}`);
    });

    const remember = $((key: string): boolean => {
      lastKey.value = key;
      return key === "Enter";
    });

    return (
      <section class="meeting-list" aria-label="Meetings">
        <ul aria-label="Upcoming">
          {upcoming.value.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick$={(_, element) => {
                  {
                    const line: string = `show ${event.title}`;
                    log.value = [...log.value, line];
                  }
                  if (!onceClick.has(element)) {
                    onceClick.add(element);
                    onOpened$?.(event.title);
                  }
                }}
              >
                {event.title}
              </button>
            </li>
          ))}
        </ul>
        <ul aria-label="Rooms">
          {rooms.value.map((room) => (
            <li key={room}>
              <button
                type="button"
                onClick$={(_, element) => {
                  {
                    const line: string = `pick ${room}`;
                    log.value = [...log.value, line];
                  }
                  if (!onceClick_1.has(element)) {
                    onceClick_1.add(element);
                    void book(room);
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
            onClick$={(_, element) => {
              {
                const line: string = `thank ${organiser.name}`;
                log.value = [...log.value, line];
              }
              if (!onceClick_2.has(element)) {
                onceClick_2.add(element);
                onThanked$?.(organiser.name);
              }
            }}
          >{`Thank ${organiser.name}`}</button>
        ) : (
          <p>No organiser</p>
        )}
        <button
          type="button"
          onClick$={(_, element) => {
            clicks.value += 1;
            if (!onceClick_3.has(element)) {
              onceClick_3.add(element);
              const event = "first-click";
              onTrack$?.(event, clicks.value);
            }
          }}
        >
          Track
        </button>
        <p>Clicks: {clicks.value}</p>
        <label>
          Filter
          <input
            name="filter"
            onKeyDown$={async (event) => {
              if (event.altKey) return false;
              return await remember(event.key);
            }}
          />
        </label>
        <p>Last key: {lastKey.value}</p>
        <ol aria-label="Log">
          {log.value.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ol>
      </section>
    );
  },
);

// The elements each `once` listener ran for: Qwik's listeners have no `once` option.
const onceClick = new WeakSet<Element>();
const onceClick_1 = new WeakSet<Element>();
const onceClick_2 = new WeakSet<Element>();
const onceClick_3 = new WeakSet<Element>();
