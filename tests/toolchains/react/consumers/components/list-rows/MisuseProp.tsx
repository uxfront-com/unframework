import Row from "../../../../../integration/cases/components/list-rows/__output__/react/Row";

export function MisuseProp() {
  // @uf-expect TS2322 Row.prop:done
  return <Row name="Read" done="no" />;
}
