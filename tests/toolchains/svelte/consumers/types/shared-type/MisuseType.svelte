<script lang="ts">
  import Palette, { type Tone } from "../../../../../integration/cases/types/shared-type/__output__/svelte/Palette.svelte";

  // @uf-expect TS2322 Palette.type:Tone
  const tone: Tone = "loud";
</script>

<Palette {tone} />
