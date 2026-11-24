<script setup lang="ts">
import SaveButton from "./SaveButton.vue";
import { ref } from "vue";

const pressed = ref(false);
</script>

<template>
  <div class="editor">
    <p id="save-hint">Saves the draft.</p>
    <SaveButton
      id="save"
      title="Save"
      aria-describedby="save-hint"
      :aria-pressed="pressed"
      data-testid="save-button"
      type="submit"
      class="primary"
    />
    <button type="button" @click="pressed = !pressed">Toggle</button>
  </div>
</template>
