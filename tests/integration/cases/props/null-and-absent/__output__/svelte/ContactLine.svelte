<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ContactLineProps {
    name: string;
    phone?: string | null;
    verified?: boolean | null;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "name" | "phone" | "verified" | "children" | "class" | "style" | "ref"
  > &
    ContactLineProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    name,
    phone,
    verified,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section
  class={["contact-line", className]}
  aria-label={name}
  {style}
  bind:this={ref}
  {...attributes}
>
  <p
    data-phone={phone === null ? "withheld" : phone}
  >Phone: {phone === null ? "withheld" : (phone ?? "not given yet")}</p
  ><p>{verified === null ? "Verification pending" : verified ? "Verified" : "Not verified"}</p>
</section>
