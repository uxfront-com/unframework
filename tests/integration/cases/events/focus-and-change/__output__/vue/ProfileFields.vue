<script setup lang="ts">
import { ref, shallowRef } from "vue";

const emit = defineEmits<{ firstNickname: [nickname: string] }>();

const log = shallowRef<string[]>([]);
const nickname = ref("");
const cardFocuses = ref(0);
const cardBlurs = ref(0);

function record(line: string) {
  log.value = [...log.value, line];
}

function hold(event: MouseEvent) {
  event.preventDefault();
  record("locked click");
}
</script>

<template>
  <section class="profile-fields" aria-label="Profile">
    <div
      class="name-group"
      role="group"
      aria-label="Name fields"
      @focusin="record('group focusin')"
      @focusout="record('group focusout')"
    >
      <label>Name<input name="name" @focus="record('name focus')" @blur="record('name blur')" /></label>
    </div>
    <label>Nickname<input
      name="nickname"
      @change="(event) => (nickname = (event.currentTarget as HTMLInputElement).value)"
      @change.once="(event) => emit('firstNickname', (event.currentTarget as HTMLInputElement).value)"
    /></label>
    <p>Nickname: {{ nickname }}</p>
    <label><input
      type="checkbox"
      name="public"
      @click="record('public click')"
      @input="record('public input')"
      @change="record('public change')"
    />Public profile</label>
    <label><input type="checkbox" name="locked" @click="hold" @change="record('locked change')" />Locked</label>
    <div
      class="card"
      role="group"
      aria-label="Card"
      tabindex="-1"
      @focus="cardFocuses++"
      @blur="cardBlurs++"
    >
      <p>{{ cardFocuses > cardBlurs ? "Card focused" : "Card not focused" }}</p>
      <p>Card blurs: {{ cardBlurs }}</p>
      <button type="button" @click="record('card button')">Inside the card</button>
    </div>
    <ol aria-label="Log">
      <li v-for="(entry, index) in log" :key="index">{{ entry }}</li>
    </ol>
  </section>
</template>
