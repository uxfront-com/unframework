import { computed, defineEmits, ref } from "unframework";

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

export default function MeetingList({ meetings, organiser }: MeetingListProps) {
  const emit = defineEmits<{
    opened: [title: string];
    thanked: [name: string];
    track: [name: string, count: number];
  }>();

  const rooms = ref(["Atlas", "Borealis"]);
  const log = ref<string[]>([]);
  const lastKey = ref("none");
  const clicks = ref(0);
  const upcoming = computed(() => meetings.filter((meeting) => !meeting.done));

  function record(line: string) {
    log.value = [...log.value, line];
  }

  function show(meeting: Meeting) {
    record(`show ${meeting.title}`);
  }

  async function book(room: string) {
    await Promise.resolve();
    record(`booked ${room}`);
  }

  function remember(key: string): boolean {
    lastKey.value = key;
    return key === "Enter";
  }

  return (
    <section class="meeting-list" aria-label="Meetings">
      <ul aria-label="Upcoming">
        {upcoming.value.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => show(event)}
              onClickOnce={() => emit("opened", event.title)}
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
              onClick={() => record(`pick ${room}`)}
              onClickOnce={async () => book(room)}
            >
              {room}
            </button>
          </li>
        ))}
      </ul>
      {organiser ? (
        <button
          type="button"
          onClick={() => record(`thank ${organiser.name}`)}
          onClickOnce={() => emit("thanked", organiser.name)}
        >
          {`Thank ${organiser.name}`}
        </button>
      ) : (
        <p>No organiser</p>
      )}
      <button
        type="button"
        onClick={() => (clicks.value += 1)}
        onClickOnce={() => {
          const event = "first-click";
          emit("track", event, clicks.value);
        }}
      >
        Track
      </button>
      <p>Clicks: {clicks.value}</p>
      <label>
        Filter
        <input
          name="filter"
          onKeydown={(event) => {
            if (event.altKey) return false;
            return remember(event.key);
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
}
