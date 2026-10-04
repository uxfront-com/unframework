<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface TagProps {
    label: string;
    colour?: string;
    weight?: number;
    indent?: string;
  }

  let { label, colour, weight, indent }: TagProps = $props();
</script>

<span
  class="tag"
  style:display="inline-block"
  style:padding="2px 8px"
  style:border-style="solid"
  style:border-width="1px"
  style:border-color={colour ?? "#5a5a5a"}
  style:color={colour}
  style:font-weight={weight}
  style:margin-left={indent}
>{label}</span>
