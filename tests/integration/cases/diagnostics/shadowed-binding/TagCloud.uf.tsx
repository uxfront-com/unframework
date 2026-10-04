// UF3024 shadowed-binding: the `.map` parameter `label` shadows the prop `label`.
export interface TagCloudProps {
  label: string;
  tags: string[];
}

export default function TagCloud({ label, tags }: TagCloudProps) {
  return (
    <ul aria-label={label}>
      {tags.map((label) => (
        <li key={label}>{label}</li>
      ))}
    </ul>
  );
}
