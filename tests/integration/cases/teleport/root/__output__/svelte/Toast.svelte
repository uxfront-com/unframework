<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ToastProps {
    message: string;
  }
</script>

<script lang="ts">
  import { teleport } from "./_unframework/teleport";
  import { onMount } from "svelte";
  import "./Toast.uf.tsx.css";

  let { message }: ToastProps = $props();

  let mounted = $state(false);

  onMount(() => {
    mounted = true;
  });
</script>

{#if mounted}
  <div
    {@attach teleport("body")}
    data-teleported="true"
    class="toast"
    role="alert"
    data-uf-416dbabb=""
  >
    <p data-uf-416dbabb="">{message}</p>
  </div>
{/if}
