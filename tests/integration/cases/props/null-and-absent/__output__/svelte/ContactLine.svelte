<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface ContactLineProps {
    name: string;
    phone?: string | null;
    verified?: boolean | null;
  }

  let { name, phone, verified }: ContactLineProps = $props();
</script>

<section class="contact-line" aria-label={name}>
  <p
    data-phone={phone === null ? "withheld" : phone}
  >Phone: {phone === null ? "withheld" : (phone ?? "not given yet")}</p
  ><p>{verified === null ? "Verification pending" : verified ? "Verified" : "Not verified"}</p>
</section>
