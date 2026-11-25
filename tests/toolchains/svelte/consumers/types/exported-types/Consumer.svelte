<script lang="ts">
  import Button from '../../../../../integration/cases/types/exported-types/__output__/svelte/Button.svelte';
import type { ButtonProps, ButtonSize } from '../../../../../integration/cases/types/exported-types/__output__/svelte/Button.svelte';

  const props: ButtonProps = { label: "Save", tone: "secondary" };
  const size: ButtonSize = "large";
</script>

<Button label={`${props.label} (${size})`} tone={props.tone} />
