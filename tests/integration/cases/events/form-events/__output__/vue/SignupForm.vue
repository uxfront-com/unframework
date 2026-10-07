<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{
  signup: [fullName: string, email: string, plan: string, newsletter: boolean];
}>();

const fullName = ref("");
const email = ref("");
const plan = ref("free");
const newsletter = ref(false);
const focused = ref("none");

function submit(event: SubmitEvent) {
  event.preventDefault();
  emit("signup", fullName.value, email.value, plan.value, newsletter.value);
}
</script>

<template>
  <form class="signup-form" aria-label="Sign up" @submit="submit">
    <label>Name<input
      name="name"
      @change="(event) => (fullName = (event.currentTarget as HTMLInputElement).value)"
      @focus="focused = 'name'"
      @blur="focused = 'none'"
    /></label>
    <label>Email<input
      name="email"
      type="email"
      @input="(event) => (email = (event.currentTarget as HTMLInputElement).value)"
      @focus="focused = 'email'"
      @blur="focused = 'none'"
    /></label>
    <label>Plan<select
      name="plan"
      @change="(event) => (plan = (event.currentTarget as HTMLSelectElement).value)"
    ><option value="free">Free</option><option value="pro">Pro</option></select></label>
    <label><input
      name="newsletter"
      type="checkbox"
      @change="(event) => (newsletter = (event.currentTarget as HTMLInputElement).checked)"
    />Send me the newsletter</label>
    <p
      role="status"
    >{{ `Name: ${fullName}; email: ${email}; plan: ${plan}; newsletter: ${newsletter ? "yes" : "no"}; focus: ${focused}` }}</p>
    <button type="submit">Sign up</button>
  </form>
</template>
