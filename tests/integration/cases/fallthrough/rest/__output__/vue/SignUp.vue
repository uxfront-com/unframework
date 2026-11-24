<script setup lang="ts">
import Field from "./Field.vue";
import { ref } from "vue";

const focuses = ref(0);
</script>

<template>
  <form aria-label="Sign up">
    <p id="email-hint">We never share it.</p>
    <Field
      id="email"
      label="Email"
      aria-describedby="email-hint"
      placeholder="you@example.com"
      class="wide"
      style="margin-top: 4px"
      @focus="() => focuses++"
    />
    <p>Focuses: {{ focuses }}</p>
  </form>
</template>
