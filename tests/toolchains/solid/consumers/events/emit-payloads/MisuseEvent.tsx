import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/solid/FileRow";

function open(index: number): number {
  return index + 1;
}

export function MisuseEvent() {
  // @uf-expect TS2322 FileRow.event:open
  return <FileRow path="notes.txt" size={12} onOpen={open} />;
}
