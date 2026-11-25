import { defineEmits, onMounted, useTemplateRef } from "@uxfront/unframework";

import { loadUser } from "./api";

// After its await: a template ref, and a mounted hook that focuses it and emits. On a hydrated
// page the hook runs again once the client's setup resolves.
export default async function Note({ id }: { id: string }) {
  const emit = defineEmits<{ ready: [name: string] }>();
  const user = await loadUser(id);
  const input = useTemplateRef<HTMLInputElement>();

  onMounted(() => {
    input.value?.focus();
    emit("ready", user.name);
  });

  return (
    <form class="note" aria-label="Note">
      <label>
        Note for {user.name} <input ref={input} type="text" />
      </label>
    </form>
  );
}
