// UF6002 unsupported-type-construct: a mapped type needs a type checker, and the default type
// oracle reads types as written; write the members out, or compile with the tsgo oracle.
export type BadgeProps = { [Key in "label" | "title"]: string };

export default function Badge({ label, title }: BadgeProps) {
  return <span class="badge" title={title}>{label}</span>;
}
