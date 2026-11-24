<script setup lang="ts">
import { ref, useTemplateRef } from "vue";

import Base from "../../../../../integration/cases/fallthrough/dynamic-root-passthrough/__output__/vue/Base.vue";

const clicks = ref(0);
const base = useTemplateRef("base");

function count(event: MouseEvent) {
  clicks.value += event.detail;
}

function focus() {
  base.value?.$el.focus();
}
</script>

<template>
  <p id="docs-hint">Clicks {{ clicks }}</p>
  <Base
    id="docs"
    ref="base"
    href="#docs"
    text="Docs"
    aria-describedby="docs-hint"
    data-testid="docs"
    @click="count"
  />
  <button type="button" @click="focus">Focus</button>
</template>
