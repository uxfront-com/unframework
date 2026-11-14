<script setup lang="ts">
import Field from "./Field.vue";

export interface SignupProps {
  name: string;
  email: string;
}

const { name, email } = defineProps<SignupProps>();
</script>

<template>
  <form class="signup" aria-label="Sign up">
    <Field :label="name" hint="As it appears on your card." />
    <Field :label="email" hint="We send the receipt here." />
  </form>
</template>
