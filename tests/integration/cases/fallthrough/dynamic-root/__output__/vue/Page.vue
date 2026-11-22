<script setup lang="ts">
import Base from "./Base.vue";
import Primary from "./Primary.vue";
import { ref, shallowRef } from "vue";

const linked = ref(true);
const tone = ref("rgb(29, 78, 216)");
const pressed = ref("none");

const items = shallowRef([
  { id: 1, href: "#one", disabled: true, label: "One" },
  { id: 2, href: "", disabled: true, label: "Two" },
]);

function onClick() {
  linked.value = !linked.value;
  tone.value = linked.value ? "rgb(29, 78, 216)" : "rgb(21, 128, 61)";
}
</script>

<template>
  <section class="page" data-uf-64cf7c28="">
    <Primary
      :href="linked ? '#docs' : undefined"
      :disabled="true"
      text="Docs"
      class="wide"
      :style="{ color: tone }"
      data-uf-64cf7c28=""
      @press="() => (pressed = 'docs')"
    />
    <Base
      :disabled="true"
      text="Off"
      class="off"
      :class="{ muted: !linked }"
      data-uf-64cf7c28=""
      @press="() => (pressed = 'off')"
    />
    <Base text="Save" class="save" data-uf-64cf7c28="" @press="() => (pressed = 'save')" />
    <ul aria-label="Items" data-uf-64cf7c28="">
      <li v-for="item in items" :key="item.id" data-uf-64cf7c28="">
        <component
          :is="item.href ? 'a' : 'button'"
          :href="(item.href ? 'a' : 'button') === 'a' ? item.href : undefined"
          :disabled="(item.href ? 'a' : 'button') === 'button' ? item.disabled : undefined"
          class="item"
          data-uf-64cf7c28=""
        >{{ item.label }}</component>
      </li>
    </ul>
    <button type="button" data-uf-64cf7c28="" @click="onClick">Toggle</button>
    <output data-uf-64cf7c28="">{{ pressed }}</output>
  </section>
</template>

<style src="./Page.uf.tsx.css"></style>
