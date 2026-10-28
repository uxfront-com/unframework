<script setup lang="ts">
import type { SubscriptionLike } from "rxjs";

export type StatusProps = Pick<SubscriptionLike, "closed"> & { label: string };

const { closed, label } = defineProps<{ closed: boolean; label: string }>();
</script>

<template>
  <p>{{ label }}: {{ closed ? "closed" : "open" }}</p>
</template>
