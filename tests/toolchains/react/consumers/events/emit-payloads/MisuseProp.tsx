import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/react/FileRow";

export function MisuseProp() {
  // @uf-expect TS2322 FileRow.prop:path
  return <FileRow path={42} size={12} />;
}
