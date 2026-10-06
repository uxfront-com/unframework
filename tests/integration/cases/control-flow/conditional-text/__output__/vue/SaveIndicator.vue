<script setup lang="ts">
export interface SaveIndicatorProps {
  saving: boolean;
  changes: number;
  savedAt?: string;
}

const { saving, changes, savedAt = undefined } = defineProps<SaveIndicatorProps>();
</script>

<template>
  <p class="save-indicator" role="status">
    <em v-if="saving">Saving</em>
    <template v-else>Saved</template>, {{ changes === 1 ? "1 change" : `${changes} changes` }}<time
      v-if="savedAt"
      :datetime="savedAt"
    >{{ " at " + savedAt }}</time>
    <template v-else> just now</template>
  </p>
</template>
