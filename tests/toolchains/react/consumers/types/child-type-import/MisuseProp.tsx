import Form from "../../../../../integration/cases/types/child-type-import/__output__/react/Form";

export function MisuseProp() {
  // @uf-expect TS2741 Form.prop:field
  return <Form field={{ name: "email" }} />;
}
