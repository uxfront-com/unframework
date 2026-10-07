<script setup lang="ts">
import { ref, shallowRef } from "vue";

export interface Settings {
  theme: string;
  size: number;
}

interface SaveReply {
  id?: number;
  error?: string;
}

const emit = defineEmits<{ applied: [theme: string, size: number]; saved: [id: number] }>();

const settings = shallowRef<Settings>({ theme: "light", size: 14 });
const maxSize = ref(20);
const saving = ref(false);
const label = ref("Never saved");
const failure = ref("");
let finish: ((reply: SaveReply) => void) | undefined;

function apply(patch: Partial<Settings>) {
  const { theme = settings.value.theme, size = settings.value.size } = patch;
  settings.value = { theme, size };
  emit("applied", theme, size);
}

function grow() {
  const clamp = (value: number, max = maxSize.value) => Math.min(value, max);
  apply({ size: clamp(settings.value.size + 4) });
}

async function save() {
  saving.value = true;
  failure.value = "";
  try {
    const reply = await new Promise<SaveReply>((resolve) => {
      finish = resolve;
    });
    if (reply.error) throw new Error(reply.error);
    const id = reply.id ?? 0;
    label.value = id === 0 ? "Saved as a draft" : `Saved as #${id}`;
    emit("saved", id);
  } catch (error) {
    failure.value = error instanceof Error ? error.message : "Saving failed";
  } finally {
    saving.value = false;
  }
}

function onClick() {
  finish?.({ id: 7 });
}

function onClick_1() {
  finish?.({});
}

function onClick_2() {
  finish?.({ error: "Disk full" });
}
</script>

<template>
  <section class="display-settings" aria-label="Display">
    <p role="status">Theme {{ settings.theme }}, size {{ settings.size }}</p>
    <button type="button" @click="apply({ theme: 'dark' })">Dark</button>
    <button type="button" @click="grow">Larger</button>
    <button type="button" @click="maxSize = 30">Allow up to 30</button>
    <button type="button" @click="save">Save</button>
    <p>{{ saving ? "Saving" : failure === "" ? label : `Failed: ${failure}` }}</p>
    <div role="group" aria-label="Server">
      <button type="button" @click="onClick">Reply with an id</button>
      <button type="button" @click="onClick_1">Reply as a draft</button>
      <button type="button" @click="onClick_2">Reply with an error</button>
    </div>
  </section>
</template>
