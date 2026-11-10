import Status from "../../../../../integration/cases/types/package-types/__output__/react/Status";

export function MisuseProp() {
  // @uf-expect TS2322 Status.prop:interval
  return <Status label="Feed" value="tick" interval="fast" />;
}
