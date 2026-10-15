import Avatar from "../../../../../integration/cases/components/acronym-names/__output__/react/Avatar";

export function Consumer() {
  return <Avatar imageURL="/b.png" userID={3} onPickedURL={(url: string) => url.length} />;
}
