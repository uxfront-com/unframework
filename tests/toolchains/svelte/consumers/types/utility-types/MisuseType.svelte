<script lang="ts">
  import TextField, { type TextFieldProps } from "../../../../../integration/cases/types/utility-types/__output__/svelte/TextField.svelte";

  // @uf-expect TS2322 TextField.type:TextFieldProps
  const field: TextFieldProps = { name: "email", label: 1 };
</script>

<TextField name={field.name} label="Email" />
