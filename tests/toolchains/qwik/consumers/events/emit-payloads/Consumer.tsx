import { $, component$ } from "@qwik.dev/core";

import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/qwik/FileRow";

export const Consumer = component$(() => {
  const open = $((path: string) => path.toUpperCase());
  return <FileRow path="notes.txt" size={12} onOpen$={open} />;
});
