<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";

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

const { meetings, organiser = undefined } = defineProps<MeetingListProps>();
const emit = defineEmits<{
  opened: [title: string];
  thanked: [name: string];
  track: [name: string, count: number];
}>();

const rooms = shallowRef(["Atlas", "Borealis"]);
const log = shallowRef<string[]>([]);
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

function onClick() {
  const event = "first-click";
  emit("track", event, clicks.value);
}

function onKeydown(event: KeyboardEvent) {
  if (event.altKey) return false;
  return remember(event.key);
}
</script>

<template>
  <section class="meeting-list" aria-label="Meetings">
    <ul aria-label="Upcoming">
      <li v-for="event in upcoming" :key="event.id">
        <button
          type="button"
          @click="show(event)"
          @click.once="emit('opened', event.title)"
        >{{ event.title }}</button>
      </li>
    </ul>
    <ul aria-label="Rooms">
      <li v-for="room in rooms" :key="room">
        <button
          type="button"
          @click="record(`pick ${room}`)"
          @click.once="async () => book(room)"
        >{{ room }}</button>
      </li>
    </ul>
    <button
      v-if="organiser"
      type="button"
      @click="record(`thank ${organiser.name}`)"
      @click.once="emit('thanked', organiser.name)"
    >{{ `Thank ${organiser.name}` }}</button>
    <p v-else>No organiser</p>
    <button type="button" @click="clicks += 1" @click.once="onClick">Track</button>
    <p>Clicks: {{ clicks }}</p>
    <label>Filter<input name="filter" @keydown="onKeydown" /></label>
    <p>Last key: {{ lastKey }}</p>
    <ol aria-label="Log">
      <li v-for="(line, index) in log" :key="index">{{ line }}</li>
    </ol>
  </section>
</template>
