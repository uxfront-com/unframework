<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { enter } from "./_unframework/transition";
  import "./Toast.uf.tsx.css";
</script>

<p in:enter|global={"pop"} class="toast" role="status" data-uf-acfe4ebf="">Saved</p>
