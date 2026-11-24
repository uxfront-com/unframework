<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface SignupProps {
    name: string;
    email: string;
  }
</script>

<script lang="ts">
  import Field from "./Field.svelte";
  import type { ClassValue, HTMLFormAttributes } from "svelte/elements";

  type Props = Omit<HTMLFormAttributes, "name" | "email" | "children" | "class" | "style" | "ref"> &
    SignupProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["form"] | null;
    };

  let {
    name,
    email,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<form class={["signup", className]} aria-label="Sign up" {style} bind:this={ref} {...attributes}>
  <Field label={name} hint="As it appears on your card."
  /><Field label={email} hint="We send the receipt here." />
</form>
