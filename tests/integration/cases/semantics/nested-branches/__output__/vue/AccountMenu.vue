<script setup lang="ts">
import { ref, shallowRef } from "vue";

interface User {
  name: string;
}

export interface AccountMenuProps {
  owner?: User;
}

const { owner = undefined } = defineProps<AccountMenuProps>();
const emit = defineEmits<{ greeted: [name: string] }>();

const step = ref("intro");
const user = shallowRef<User | null>(null);

function start() {
  step.value = "account";
}

function signIn() {
  user.value = { name: "Ada" };
}

function signOut() {
  user.value = null;
}

function greet(name: string) {
  emit("greeted", name);
}
</script>

<template>
  <section class="account-menu" aria-label="Account">
    <button v-if="step === 'intro'" type="button" @click="start">Start</button>
    <template v-else>
      <button v-if="user === null" type="button" @click="signIn">Sign in</button>
      <button v-else type="button" @click="signOut">Sign out</button>
    </template>
    <p v-if="user !== null">Signed in as {{ user.name }}</p>
    <p v-else>Nobody signed in</p>
    <button
      v-if="owner"
      type="button"
      @click="greet(owner.name)"
    >{{ `Greet ${owner.name}` }}</button>
    <p v-else>No owner</p>
  </section>
</template>
