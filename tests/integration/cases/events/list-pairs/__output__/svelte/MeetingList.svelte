<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { on } from "svelte/events";

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

  type Props = MeetingListProps & {
    onopened?: (title: string) => void;
    onthanked?: (name: string) => void;
    ontrack?: (name: string, count: number) => void;
  };

  let { meetings, organiser, onopened, onthanked, ontrack }: Props = $props();

  let rooms = $state.raw(["Atlas", "Borealis"]);
  let log = $state.raw<string[]>([]);
  let lastKey = $state("none");
  let clicks = $state(0);
  const upcoming = $derived(meetings.filter((meeting) => !meeting.done));

  function record(line: string) {
    log = [...log, line];
  }

  function show(meeting: Meeting) {
    record(`show ${meeting.title}`);
  }

  async function book(room: string) {
    await Promise.resolve();
    record(`booked ${room}`);
  }

  function remember(key: string): boolean {
    lastKey = key;
    return key === "Enter";
  }

  function once<E extends Event>(handler: (event: E) => unknown): (event: E) => void {
    let ran = false;
    return (event) => {
      if (ran) return;
      ran = true;
      handler(event);
    };
  }
</script>

<section class="meeting-list" aria-label="Meetings">
  <ul aria-label="Upcoming">
    {#each upcoming as event (event.id)}
      <li>
        <button
          type="button"
          {@attach (node) => on(node, "click", () => show(event))}
          {@attach (node) => on(node, "click", once(() => onopened?.(event.title)))}
        >{event.title}</button>
      </li>
    {/each}
  </ul
  ><ul aria-label="Rooms">
    {#each rooms as room (room)}
      <li>
        <button
          type="button"
          {@attach (node) => on(node, "click", () => record(`pick ${room}`))}
          {@attach (node) => on(node, "click", once(async () => book(room)))}
        >{room}</button>
      </li>
    {/each}
  </ul
  >{#if organiser}
    <button
      type="button"
      {@attach (node) => on(node, "click", () => record(`thank ${organiser.name}`))}
      {@attach (node) => on(node, "click", once(() => onthanked?.(organiser.name)))}
    >{`Thank ${organiser.name}`}</button>
  {:else}
    <p>No organiser</p>
  {/if}<button
    type="button"
    {@attach (node) => on(node, "click", () => (clicks += 1))}
    {@attach (node) => on(node, "click", once(() => {
      const event = "first-click";
      ontrack?.(event, clicks);
    }))}
  >Track</button
  ><p>Clicks: {clicks}</p
  ><label>Filter<input
    name="filter"
    onkeydown={(event) => {
      if (event.altKey) return false;
      return remember(event.key);
    }}
  /></label
  ><p>Last key: {lastKey}</p
  ><ol aria-label="Log">
    {#each log as line, index (index)}
      <li>{line}</li>
    {/each}
  </ol>
</section>
