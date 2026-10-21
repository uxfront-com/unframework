<script setup lang="ts">
import Heading from "./Heading.vue";
import Status from "./Status.vue";
</script>

<template>
  <section class="panel" data-uf-34db6205="">
    <Heading :big="true" text="Release" data-uf-34db6205="" />
    <Heading :big="false" text="Notes" data-uf-34db6205="" />
    <Status :busy="false" text="Save" data-uf-34db6205="" />
    <Status :busy="true" text="Save" data-uf-34db6205="" />
  </section>
</template>

<style src="./Panel.uf.tsx.css"></style>
