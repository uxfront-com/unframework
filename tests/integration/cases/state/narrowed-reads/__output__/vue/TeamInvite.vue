<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from "vue";

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

const { inviter = undefined, members } = defineProps<TeamInviteProps>();
const emit = defineEmits<{
  select: [member: Member];
  removed: [name: string];
  submitted: [email: string];
  tagged: [count: number];
  moved: [page: number];
}>();

const greeting = computed(() => (inviter ? `Invite as ${inviter.name}` : "Invite as a guest"));
const selected = shallowRef<Member | null>(null);
const draft = shallowRef<Draft>({ tags: null });
const page = ref(1);
const pageCount = computed(() => Math.ceil(members.length / 2));
const visible = computed(() => members.slice((page.value - 1) * 2, page.value * 2));
const byPassword = ref(true);
const seconds = ref(0);
const timer = shallowRef<ReturnType<typeof setInterval>>();

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

function onClick() {
  page.value -= 1;
  emit("moved", page.value);
}

function onClick_1() {
  page.value += 1;
  emit("moved", page.value);
}
</script>

<template>
  <section class="team-invite" aria-label="Invite">
    <h2>{{ greeting }}</h2>
    <ul aria-label="Members">
      <li v-for="member in visible" :key="member.id">
        <button
          type="button"
          :aria-pressed="selected !== null && selected.id === member.id"
          @click="pick(member)"
        >{{ member.name }}</button>
      </li>
    </ul>
    <div class="pager" role="group" aria-label="Pages">
      <button v-if="page > 1" type="button" @click="onClick">Previous</button>
      <span>Page {{ page }} of {{ pageCount }}</span>
      <button v-if="page < pageCount" type="button" @click="onClick_1">Next</button>
    </div>
    <p role="status">{{ selected ? `Selected: ${selected.name}` : "Nobody selected" }}</p>
    <button type="button" @click="invite">Invite</button>
    <button type="button" @click="remove">Remove</button>
    <form aria-label="Email invite" @submit="submit">
      <label>Email<input
        type="email"
        name="email"
        @input="(event) => (draft = {
          ...draft,
          email: (event.currentTarget as HTMLInputElement).value,
        })"
      /></label>
      <button type="submit">Send</button>
    </form>
    <button type="button" @click="tag">Tag as team</button>
    <button
      type="button"
      @click="byPassword = !byPassword"
    >{{ byPassword ? "Use a link" : "Use a password" }}</button>
    <div class="field">
      <input v-if="byPassword" type="password" aria-label="Password" />
      <template v-else>
        <input type="text" aria-label="Sign-in email" />
        <small>We send you a link.</small>
      </template>
    </div>
    <button type="button" @click="start">Start the clock</button>
    <button type="button" @click="stop">Stop the clock</button>
    <p>Seconds: {{ seconds }}</p>
  </section>
</template>
