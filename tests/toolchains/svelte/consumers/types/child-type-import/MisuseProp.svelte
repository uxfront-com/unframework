<script lang="ts">
  import Form from "../../../../../integration/cases/types/child-type-import/__output__/svelte/Form.svelte";
</script>

<!-- @uf-expect TS2741 Form.prop:field -->
<Form field={{ name: "email" }} />
