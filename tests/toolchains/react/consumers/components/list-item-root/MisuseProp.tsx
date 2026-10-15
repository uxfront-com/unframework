import Menu from "../../../../../integration/cases/components/list-item-root/__output__/react/Menu";

export function MisuseProp() {
  // @uf-expect TS2322 Menu.prop:entries
  return <Menu entries="Home" />;
}
