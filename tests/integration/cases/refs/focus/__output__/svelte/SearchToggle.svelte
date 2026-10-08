<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let field: HTMLInputElement | null = null;
  let trigger: HTMLButtonElement | null = null;

  function focusField() {
    field?.focus();
  }

  function returnFocus(event: KeyboardEvent) {
    if (event.key === "Escape") trigger?.focus();
  }
</script>

<div class="search-toggle" role="search">
  <button type="button" bind:this={trigger} onclick={focusField}>Search</button
  ><input name="query" aria-label="Search the docs" bind:this={field} onkeydown={returnFocus} />
</div>
