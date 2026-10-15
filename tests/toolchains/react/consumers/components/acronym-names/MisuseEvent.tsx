import Avatar from "../../../../../integration/cases/components/acronym-names/__output__/react/Avatar";

export function MisuseEvent() {
  // @uf-expect TS2322 Avatar.event:pickedURL
  return <Avatar imageURL="/b.png" userID={3} onPickedURL={(count: number) => count + 1} />;
}
