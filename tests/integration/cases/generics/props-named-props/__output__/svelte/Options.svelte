<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" generics="T">
  interface Props<T> {
    heading: string;
    options: T[];
    selected?: T;
  }

  let { heading, options, selected }: Props<T> = $props();
</script>

<h2>{heading}</h2
><ul aria-label={heading}>
  {#each options as option, index (index)}
    <li aria-current={option === selected ? "true" : undefined}>{String(option)}</li>
  {/each}
</ul>
