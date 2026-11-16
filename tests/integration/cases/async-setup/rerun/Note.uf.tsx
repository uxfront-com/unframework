import { defineEmits, onMounted, provide, useTemplateRef } from "@uxfront/unframework";

import { loadUser } from "./api";
import Badge, { ToneKey } from "./Badge.uf.tsx";

// After its await: a template ref, a mounted hook that focuses it and emits, and a provided
// constant a child reads. On a hydrated page they run again once the client's setup resolves.
export default async function Note({ id }: { id: string }) {
  const emit = defineEmits<{ ready: [name: string] }>();
  const user = await loadUser(id);
  const input = useTemplateRef<HTMLInputElement>();

  provide(ToneKey, "calm");

  onMounted(() => {
    input.value?.focus();
    emit("ready", user.name);
  });

  return (
    <form class="note" aria-label="Note">
      <label>
        Note for {user.name} <input ref={input} type="text" />
      </label>
      <Badge />
    </form>
  );
}
