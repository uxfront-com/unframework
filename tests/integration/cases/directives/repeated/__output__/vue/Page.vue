<script setup lang="ts">
import Choice from "./Choice.vue";
import List from "./List.vue";
import Wrapper from "./Wrapper.vue";
import { vTrace } from "./vTrace";
import { ref, useTemplateRef } from "vue";

const label = ref("first");
const note = useTemplateRef<HTMLParagraphElement>("note");
const noted = ref("");
</script>

<template>
  <section class="page" aria-label="Page">
    <Wrapper>
      <template #row>
        <span v-trace="label" data-name="row">Row</span>
      </template>
    </Wrapper>
    <Choice>
      <template #body>
        <em v-trace="label" data-name="body">Body</em>
      </template>
    </Choice>
    <List :items="['a', 'b']">
      <template #item="{ item }">
        <strong v-trace="label" data-name="item">{{ item }}</strong>
      </template>
    </List>
    <p ref="note" v-trace="label" data-name="note">Note</p>
    <output>{{ noted }}</output>
    <button type="button" @click="noted = note?.getAttribute('data-name') ?? ''">Check</button>
    <button type="button" @click="label = 'second'">Rename</button>
  </section>
</template>
