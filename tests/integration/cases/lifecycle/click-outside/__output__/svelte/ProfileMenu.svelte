<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";

  type Props = { onclosed?: () => void };

  let { onclosed }: Props = $props();

  let open = $state(false);
  let menu: HTMLDivElement | null = null;

  function onDocumentClick(event: MouseEvent) {
    const element = menu;
    if (open && element && !element.contains(event.target as Node)) {
      open = false;
      onclosed?.();
    }
  }

  onMount(() => {
    document.addEventListener("click", onDocumentClick);
  });

  onMount(() => () => {
    document.removeEventListener("click", onDocumentClick);
  });
</script>

<section class="profile-menu" aria-label="Profile">
  <div class="menu" bind:this={menu}>
    <button type="button" aria-expanded={open} onclick={() => (open = !open)}>Account</button
    >{#if open}
      <ul aria-label="Account actions">
        <li>
          <button type="button">Settings</button>
        </li
        ><li>
          <button type="button">Sign out</button>
        </li>
      </ul>
    {/if}
  </div
  ><p>Outside the menu</p>
</section>
