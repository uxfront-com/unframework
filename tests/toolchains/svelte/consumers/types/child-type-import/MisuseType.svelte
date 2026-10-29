<script lang="ts">
  import Field, { type FieldProps } from "../../../../../integration/cases/types/child-type-import/__output__/svelte/Field.svelte";

  // @uf-expect TS2322 Field.type:FieldProps
  const field: FieldProps = { name: 1, label: "Email" };
</script>

<Field name="email" label={field.label} />
