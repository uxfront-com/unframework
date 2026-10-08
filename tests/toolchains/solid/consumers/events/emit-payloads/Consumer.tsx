import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/solid/FileRow";

function open(path: string): string {
  return path.toUpperCase();
}

export function Consumer() {
  return <FileRow path="notes.txt" size={12} onOpen={open} />;
}
