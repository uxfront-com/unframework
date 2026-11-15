<script setup lang="ts">
// A copy of @uxfront/layer-docs's own (0.8), which puts the framework select above
// the sidebar navigation, with a fixed id on its label in place of useId(). On
// this site, useId() gives the label one id in the prerendered page and another
// once the page hydrates, so the select's aria-labelledby names nothing and the
// select has no name. The sidebar renders once per page, so the id is unique.
// Drop this copy once the layer labels the select the same way.
import DocusAsideLeftTop from "docus/app/components/docs/DocsAsideLeftTop.vue";

const { frameworks } = useFramework();
const labelId = "docs-aside-framework-label";
</script>

<template>
  <div v-if="frameworks.length">
    <span :id="labelId" class="w-full pr-2.5 py-1.5 flex items-center text-sm text-muted">
      Framework
    </span>
    <DocsFrameworkSelect :aria-labelledby="labelId" class="mb-2" />
  </div>
  <DocusAsideLeftTop />
</template>
