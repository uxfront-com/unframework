// UF3013 missing-key: a list item without `key`; the likely fix keys it by its index.
export interface TagListProps {
  tags: string[];
}

export default function TagList({ tags }: TagListProps) {
  return (
    <ul>
      {tags.map((tag) => (
        <li>{tag}</li>
      ))}
    </ul>
  );
}
