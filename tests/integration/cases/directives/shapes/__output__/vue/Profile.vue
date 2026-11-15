<script setup lang="ts">
import { vSelectable } from "./vSelectable";
import { type ObjectDirective, ref, shallowRef } from "vue";

interface User {
  name: string;
}

const hooks = "data-hooks";
const element = "data-element";

const vMark: ObjectDirective<HTMLElement, string> = {
  mounted(el, { value }) {
    el.setAttribute(hooks, value);
    el.setAttribute(element, "mounted");
    return el;
  },
  updated(el, { value, oldValue: oldValue_1 }) {
    if (Object.is(value, oldValue_1)) return;
    const oldValue = "updated";
    el.setAttribute(hooks, `${oldValue} ${value}`);
  },
  unmounted() {},
};

const user = shallowRef<User | null>({ name: "Ada" });
const note = ref("Hello");
const label = ref<string | number>("Lovelace");
const nick = ref<string | undefined>("Al");

const vTextCaret = {
  mounted(element: HTMLTextAreaElement) {
    const text = element.value;
    element.value = "";
    element.value = text;
  },
};
</script>

<template>
  <section class="profile" aria-label="Profile">
    <p v-if="user" v-mark="user.name">{{ user.name }}</p>
    <b v-if="typeof label === 'string'" v-mark="label">{{ label }}</b>
    <i v-if="nick" v-mark="nick">{{ nick }}</i>
    <textarea
      v-model="note"
      v-text-caret
      v-mark="note"
      v-selectable="true"
      aria-label="Note"
    ></textarea>
    <button type="button" @click="user = user ? null : { name: 'Grace' }">Toggle</button>
    <button type="button" @click="label = 1">Count</button>
    <button type="button" @click="nick = undefined">Forget</button>
  </section>
</template>
