<script lang="ts">
export interface SignupProps {
  name: string;
  email: string;
}
</script>

<script setup vapor lang="ts">
import Field from "./Field.vue";

const { name, email } = defineProps<SignupProps>();
</script>

<template>
  <form class="signup" aria-label="Sign up">
    <Field :label="name" hint="As it appears on your card." />
    <Field :label="email" hint="We send the receipt here." />
  </form>
</template>
