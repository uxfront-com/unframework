<script lang="ts">
  import Button, { type ButtonProps, type ButtonSize } from "../../../../../integration/cases/types/exported-types/__output__/svelte/Button.svelte";

  // @uf-expect TS2322 Button.type:ButtonProps
  const props: ButtonProps = { label: "Save", tone: "danger" };
  // @uf-expect TS2322 Button.type:ButtonSize
  const size: ButtonSize = "huge";
</script>

<Button label={`${props.label} (${size})`} />
