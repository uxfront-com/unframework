import Card from "../../../../../integration/cases/dynamic/components/__output__/react/Card";
import Chip from "../../../../../integration/cases/dynamic/components/__output__/react/Chip";
import Tag from "../../../../../integration/cases/dynamic/components/__output__/react/Tag";

export function Consumer() {
  return (
    <>
      <Tag label="Sale" />
      <Chip label="New" />
      <Card label="Old" />
    </>
  );
}
