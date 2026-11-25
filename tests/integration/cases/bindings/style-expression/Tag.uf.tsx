export interface TagProps {
  label: string;
  tone?: string;
}

// Its root's own declarations, which a consumer's declaration list merges over.
export default function Tag({ label }: TagProps) {
  return (
    <em class="tag" style="color: rgb(120, 30, 30); padding: 1px 4px">
      {label}
    </em>
  );
}
