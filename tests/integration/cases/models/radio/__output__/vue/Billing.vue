<script setup lang="ts">
import { ref } from "vue";

const plan = ref("monthly");
</script>

<template>
  <fieldset>
    <legend>Billing</legend>
    <label><input v-model="plan" type="radio" name="plan" value="monthly" /> Monthly</label>
    <label><input v-model="plan" type="radio" name="plan" value="yearly" /> Yearly</label>
    <output>Plan: {{ plan }}</output>
    <button type="button" @click="plan = 'monthly'">Reset</button>
  </fieldset>
</template>
