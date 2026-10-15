import Level from "../../../../../integration/cases/context/nested/__output__/react/Level";

export function MisuseSlot() {
  // @uf-expect TS2322 Level.slot:default
  return <Level title="Book">{() => "Part"}</Level>;
}
