<script lang="ts">
  import TextField from "../../../../../integration/cases/types/utility-types/__output__/svelte/TextField.svelte";
</script>

<!-- @uf-expect TS2322 TextField.prop:placeholder -->
<TextField name="email" label="Email" placeholder={1} />
