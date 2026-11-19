<script lang="ts">
export interface FilesProps {
  file: string;
}
</script>

<script setup vapor lang="ts">
import ConfirmDialog from "./ConfirmDialog.vue";
import { onMounted, ref } from "vue";

const { file } = defineProps<FilesProps>();
const emit = defineEmits<{ delete: [file: string] }>();

const open = ref(false);

function confirm() {
  open.value = false;
  emit("delete", file);
}

const mounted = ref(false);

onMounted(() => {
  mounted.value = true;
});
</script>

<template>
  <section class="files" aria-label="Files">
    <p>{{ file }}</p>
    <button type="button" @click="open = true">Delete {{ file }}</button>
    <template v-if="open">
      <Teleport v-if="mounted" to="body">
        <div data-teleported="true" class="backdrop">
          <ConfirmDialog
            :title="`Delete ${file}?`"
            @confirm="confirm"
            @close="() => (open = false)"
          />
        </div>
      </Teleport>
    </template>
  </section>
</template>
