<script setup lang="ts">
import EachAction from "./EachAction.vue";
import FadeFace from "./FadeFace.vue";
import FramedNote from "./FramedNote.vue";
import OnceAction from "./OnceAction.vue";
import RowList from "./RowList.vue";
import TagList from "./TagList.vue";
import { ref } from "vue";

const bold = ref(true);
</script>

<template>
  <section class="shelf">
    <RowList label="Produce" :items="['Apples', 'Pears', 'Plums']">
      <em>fresh</em>
    </RowList>
    <FramedNote title="Release notes">
      <strong>Draft</strong>
    </FramedNote>
    <TagList :ordered="true" label="Ranked" :items="['gold', 'silver']">
      <span>Medal</span>
    </TagList>
    <TagList :ordered="false" label="Unranked" :items="['red', 'blue']">
      <span>Colour</span>
    </TagList>
    <OnceAction href="#once" label="Once">Open once</OnceAction>
    <OnceAction label="Single">Press once</OnceAction>
    <EachAction href="#each" :items="['one', 'two']">Open each</EachAction>
    <EachAction :items="['three', 'four']">Press each</EachAction>
    <FadeFace :bold="bold">Face</FadeFace>
    <button type="button" @click="bold = !bold">Swap face</button>
  </section>
</template>
