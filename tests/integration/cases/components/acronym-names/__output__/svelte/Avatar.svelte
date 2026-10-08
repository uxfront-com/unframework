<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  type Props = { imageURL: string; userID: number; onpickedurl?: (url: string) => void };

  let { imageURL, userID, onpickedurl }: Props = $props();
</script>

<button
  type="button"
  data-user={userID}
  onclick={() => onpickedurl?.(imageURL)}
>User {userID}: {imageURL}</button>
