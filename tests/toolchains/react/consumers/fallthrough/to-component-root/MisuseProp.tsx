import Primary from "../../../../../integration/cases/fallthrough/to-component-root/__output__/react/Primary";

export function MisuseProp() {
  // @uf-expect TS2322 Primary.prop:text
  return <Primary text={true} />;
}
