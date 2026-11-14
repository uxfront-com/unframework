<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface SignupProps {
    name: string;
    email: string;
  }
</script>

<script lang="ts">
  import Field from "./Field.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = SignupProps & { class?: ClassValue; style?: string };

  let { name, email, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<form class={["signup", className]} aria-label="Sign up" {style} {...scopeAttributes(attributes)}>
  <Field label={name} hint="As it appears on your card."
  /><Field label={email} hint="We send the receipt here." />
</form>
