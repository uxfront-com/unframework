<script setup lang="ts">
import { computed, ref, shallowRef, useId } from "vue";

export interface CityPickerProps {
  cities: string[];
}

const { cities } = defineProps<CityPickerProps>();
const emit = defineEmits<{ chose: [city: string]; noted: [text: string] }>();

const listId = `uf-id-${useId()}`;
const query = ref("");
const open = ref(false);
const active = ref(-1);
const chosen = ref("");
const notes = shallowRef<string[]>([]);
const matches = computed(() =>
  cities.filter((city) => city.toLowerCase().startsWith(query.value.toLowerCase())),
);

function choose(city: string) {
  chosen.value = city;
  open.value = false;
  active.value = -1;
  emit("chose", city);
}

function onCityKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      open.value = true;
      active.value = Math.min(active.value + 1, matches.value.length - 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      active.value = Math.max(active.value - 1, 0);
      break;
    case "Enter": {
      event.preventDefault();
      const city = matches.value[active.value];
      if (open.value && city !== undefined) choose(city);
      break;
    }
    case "Escape":
      event.preventDefault();
      open.value = false;
      active.value = -1;
      break;
  }
}

function onNoteKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    const field = event.target as HTMLTextAreaElement;
    notes.value = [...notes.value, field.value];
    emit("noted", field.value);
    field.value = "";
  }
}

function onInput(event: InputEvent) {
  query.value = (event.currentTarget as HTMLInputElement).value;
  open.value = true;
  active.value = -1;
}
</script>

<template>
  <section class="city-picker" aria-label="Trip">
    <form role="search" aria-label="Destination" @submit.prevent>
      <label>City<input
        type="search"
        name="city"
        role="combobox"
        aria-autocomplete="list"
        :aria-controls="open ? listId : undefined"
        :aria-expanded="open"
        :aria-activedescendant="open && active >= 0 ? `${listId}-${active}` : undefined"
        @input="onInput"
        @keydown="onCityKeydown"
        @blur="open = false"
      /></label>
      <div v-if="open" :id="listId" role="listbox" aria-label="Cities">
        <button
          v-for="(city, index) in matches"
          :id="`${listId}-${index}`"
          :key="city"
          type="button"
          role="option"
          tabindex="-1"
          :aria-selected="index === active"
          @mousedown.prevent
          @click="choose(city)"
        >{{ city }}</button>
      </div>
      <button type="submit">Search</button>
    </form>
    <p role="status">{{ chosen === "" ? "No city chosen" : `Chosen: ${chosen}` }}</p>
    <label>Note<textarea name="note" @keydown="onNoteKeydown"></textarea></label>
    <ul aria-label="Notes">
      <li v-for="(note, index) in notes" :key="index">{{ note }}</li>
    </ul>
  </section>
</template>
