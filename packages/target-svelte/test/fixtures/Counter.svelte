<svelte:options runes={true} />

<script lang="ts">
  // A counter as the target emits one: state, and a handler that writes it and calls the
  // event's callback prop, `onchange` (the event's name in lower case, D8).
  interface Props {
    step?: number;
    onchange?: (value: number) => void;
    onvaluechange?: (value: number) => void;
  }

  let { step = 1, onchange, onvaluechange }: Props = $props();
  let count = $state(0);

  function add() {
    count += step;
    onchange?.(count);
    onvaluechange?.(count);
  }
</script>

<div>
  <p role="status">{count}</p>
  <button type="button" onclick={add}>Add</button>
</div>
