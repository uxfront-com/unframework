import List from "../../../../../integration/cases/generics/list/__output__/solid/List";

export function MisuseProp() {
  // @uf-expect TS2322 List.prop:selected
  return <List label="Numbers" items={[1, 2]} selected="two" />;
}
