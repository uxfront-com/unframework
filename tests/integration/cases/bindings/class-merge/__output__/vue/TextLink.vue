<script setup lang="ts">
interface LinkAttributes {
  class?: string;
  title?: string;
  rel?: string;
}

interface RowAttributes {
  class: string;
  id?: string;
}

export interface TextLinkProps {
  href: string;
  label: string;
  strong: boolean;
  link: LinkAttributes;
  row: RowAttributes;
}

const { href, label, strong, link, row } = defineProps<TextLinkProps>();
</script>

<template>
  <p :id="row.id" class="link-row" :class="[row.class, { 'link-row-strong': strong }]">
    <a
      :href="href"
      class="text-link"
      :class="link.class"
      :title="link.title"
      :rel="link.rel"
    >{{ label }}</a>
  </p>
</template>
