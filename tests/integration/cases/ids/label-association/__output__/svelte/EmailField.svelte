<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface EmailFieldProps {
    label: string;
    hint: string;
  }

  let { label, hint }: EmailFieldProps = $props();

  const uid = $props.id();
  const inputId = `uf-id-${uid}-0`;
  const hintId = `uf-id-${uid}-1`;
</script>

<div class="email-field">
  <label for={inputId}>{label}</label
  ><input id={inputId} name="email" type="email" aria-describedby={hintId}
  /><p id={hintId}>{hint}</p>
</div>
