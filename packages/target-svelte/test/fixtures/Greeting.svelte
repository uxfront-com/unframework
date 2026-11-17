<script lang="ts">
  // An async component (ADR-0101): it awaits at the top of its instance script, so the toolchain
  // compiles it in Svelte's async mode, whose runtime flag is then on for the whole page.
  let { name }: { name: string } = $props();

  const greeting = await Promise.resolve(`Hello, ${name}`);
</script>

<p>{greeting}</p>
