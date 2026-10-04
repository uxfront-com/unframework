// UF3021 impure-render-expression: `sort()` mutates the array it is called on; the safe fix
// writes `toSorted()`.
export interface SortedTagsProps {
  tags: string[];
}

export default function SortedTags({ tags }: SortedTagsProps) {
  return <p>Tags: {tags.sort().join(", ")}</p>;
}
