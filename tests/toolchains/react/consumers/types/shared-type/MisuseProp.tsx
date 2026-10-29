import Palette from "../../../../../integration/cases/types/shared-type/__output__/react/Palette";

export function MisuseProp() {
  // @uf-expect TS2322 Palette.prop:tone
  return <Palette tone="loud" />;
}
