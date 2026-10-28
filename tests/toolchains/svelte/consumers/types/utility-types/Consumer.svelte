<script lang="ts">
  import TextField, { type TextFieldProps } from "../../../../../integration/cases/types/utility-types/__output__/svelte/TextField.svelte";

  const field: TextFieldProps = { name: "email", label: "Email" };
</script>

<TextField name={field.name} label={field.label} placeholder="you@example.com" required />
