<script lang="ts">
  import Post from "../../../../../integration/cases/slots/named/__output__/svelte/Post.svelte";
</script>

<!-- @uf-expect TS2322 Post.prop:author -->
<Post author={42} />
