<script setup lang="ts">
export interface NavItemProps {
  label: string;
  href: string;
  active: boolean;
  muted: boolean;
  danger?: boolean;
}

const { label, href, active, muted, danger = false } = defineProps<NavItemProps>();
</script>

<template>
  <a
    :href="href"
    :class="{ active, 'nav-item-muted': muted, 'nav-item-danger': danger, 'text-danger': danger }"
    :aria-current="active ? 'page' : undefined"
  >{{ label }}</a>
</template>
