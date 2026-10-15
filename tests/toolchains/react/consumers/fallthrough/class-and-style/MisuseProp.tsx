import Tag from "../../../../../integration/cases/fallthrough/class-and-style/__output__/react/Tag";

export function MisuseProp() {
  // @uf-expect TS2322 Tag.prop:label
  return <Tag label={[]} />;
}
