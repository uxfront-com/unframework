<script setup lang="ts">
import Emphasis from "./Emphasis.vue";
import FadeAction from "./FadeAction.vue";
import Greeting from "./Greeting.vue";
import IconAction from "./IconAction.vue";
import LabelAction from "./LabelAction.vue";
import SwitchAction from "./SwitchAction.vue";
import TipAction from "./TipAction.vue";
import { ref } from "vue";

const linked = ref(true);
const strong = ref(true);
const signedIn = ref(true);
const tips = ref(false);
const ada = { name: "Ada" };
const grace = { name: "Grace" };
</script>

<template>
  <section class="page">
    <LabelAction href="#docs" label="Docs">Read the docs</LabelAction>
    <LabelAction label="Save">Save the draft</LabelAction>
    <LabelAction href="#home" label="Home" />
    <LabelAction label="Close" />
    <FadeAction href="#guide" label="Guide">Read the guide</FadeAction>
    <FadeAction label="Send">Send the draft</FadeAction>
    <FadeAction href="#blog" label="Blog" />
    <FadeAction label="Undo" />
    <IconAction href="#faq" label="FAQ">Read the FAQ</IconAction>
    <IconAction label="Print">Print the draft</IconAction>
    <IconAction href="#news" label="News" />
    <IconAction label="Reset" />
    <SwitchAction :href="linked ? '#more' : undefined">Learn more</SwitchAction>
    <Emphasis :strong="strong">Mind the gap</Emphasis>
    <Greeting :user="signedIn ? ada : undefined">Welcome back</Greeting>
    <Greeting :user="signedIn ? grace : undefined" />
    <div v-if="tips" class="tips">
      <TipAction href="#tips" label="Tips">Linked tip</TipAction>
      <TipAction label="Help">Button tip</TipAction>
      <TipAction href="#about" label="About" />
      <TipAction label="Hint" />
    </div>
    <button type="button" @click="linked = !linked">Toggle link</button>
    <button type="button" @click="strong = !strong">Toggle emphasis</button>
    <button type="button" @click="signedIn = !signedIn">Toggle user</button>
    <button type="button" @click="tips = true">Show tips</button>
  </section>
</template>
