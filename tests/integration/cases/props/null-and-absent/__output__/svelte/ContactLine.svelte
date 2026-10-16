<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface ContactLineProps {
    name: string;
    phone?: string | null;
    verified?: boolean | null;
  }

  type Props = ContactLineProps & { class?: ClassValue; style?: string };

  let { name, phone, verified, class: className, style }: Props = $props();
</script>

<section class={["contact-line", className]} aria-label={name} {style}>
  <p
    data-phone={phone === null ? "withheld" : phone}
  >Phone: {phone === null ? "withheld" : (phone ?? "not given yet")}</p
  ><p>{verified === null ? "Verification pending" : verified ? "Verified" : "Not verified"}</p>
</section>
