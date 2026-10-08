import { component$ } from "@qwik.dev/core";

import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/qwik/FileRow";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 FileRow.prop:path
  return <FileRow path={42} size={12} />;
});
