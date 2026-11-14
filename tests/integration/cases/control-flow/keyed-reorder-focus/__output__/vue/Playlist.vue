<script setup lang="ts">
import { shallowRef } from "vue";

export interface Track {
  id: number;
  title: string;
  starred: boolean;
}

export interface PlaylistProps {
  initial: Track[];
}

const { initial } = defineProps<PlaylistProps>();

const tracks = shallowRef(initial);

function sortByTitle() {
  tracks.value = tracks.value.toSorted((a, b) => a.title.localeCompare(b.title));
}

function toggleStar(id: number) {
  tracks.value = tracks.value.map((track) =>
    track.id === id ? { ...track, starred: !track.starred } : track,
  );
}
</script>

<template>
  <section class="playlist">
    <ol aria-label="Playlist">
      <li v-for="track in tracks" :key="track.id">
        <label><input type="checkbox" name="queued" :value="track.id" />{{ track.starred ? `${track.title} (starred)` : track.title }}</label>
        <button
          type="button"
          :aria-pressed="track.starred"
          @click="toggleStar(track.id)"
        >{{ `Star ${track.title}` }}</button>
      </li>
    </ol>
    <button type="button" @click="sortByTitle">Sort by title</button>
  </section>
</template>
