<script setup lang="ts">
import { ref, useTemplateRef } from "vue";

import NameField from "../../../../../integration/cases/fallthrough/root-ref/__output__/vue/NameField.vue";

const clicks = ref(0);
const field = useTemplateRef("field");

function focus() {
	field.value?.$el.focus();
}
</script>

<template>
	<p id="name-hint">Hint</p>
	<NameField
		id="name"
		ref="field"
		label="Name"
		aria-describedby="name-hint"
		placeholder="Ada"
		@click="(event) => (clicks += event.detail)"
	/>
	<button type="button" @click="focus">Focus</button>
</template>
