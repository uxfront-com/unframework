<script setup vapor lang="ts">
import Badge from "./Badge.vue";
import Panel from "./Panel.vue";
</script>

<template>
  <main>
    <Suspense>
      <Panel id="ada">
        <Badge />
      </Panel>
    </Suspense>
  </main>
</template>
