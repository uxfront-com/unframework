<script lang="ts">
  import type { FieldProps } from "../../../../../integration/cases/types/child-type-import/__output__/svelte/Field.svelte";
  import Form from "../../../../../integration/cases/types/child-type-import/__output__/svelte/Form.svelte";

  const field: FieldProps = { name: "email", label: "Email" };
</script>

<Form {field} />
