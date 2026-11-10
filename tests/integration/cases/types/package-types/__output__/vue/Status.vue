<script setup lang="ts">
import type { Labelled } from "./types";
import type { TimeInterval } from "rxjs";

type StatusProps = TimeInterval<string> & Labelled;

const { value, interval, label } = defineProps<{
  value: StatusProps["value"];
  interval: StatusProps["interval"];
  label: StatusProps["label"];
}>();
</script>

<template>
  <p>{{ label }}: {{ value }} after {{ interval }} ms</p>
</template>
