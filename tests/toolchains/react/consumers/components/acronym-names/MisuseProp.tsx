import Avatar from "../../../../../integration/cases/components/acronym-names/__output__/react/Avatar";

export function MisuseProp() {
  // @uf-expect TS2322 Avatar.prop:userID
  return <Avatar imageURL="/b.png" userID="three" />;
}
