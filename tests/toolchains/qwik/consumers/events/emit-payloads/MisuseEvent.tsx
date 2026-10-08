import { $, component$ } from "@qwik.dev/core";

import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/qwik/FileRow";

export const MisuseEvent = component$(() => {
  const open = $((index: number) => index + 1);
  // @uf-expect TS2322 FileRow.event:open
  return <FileRow path="notes.txt" size={12} onOpen$={open} />;
});
