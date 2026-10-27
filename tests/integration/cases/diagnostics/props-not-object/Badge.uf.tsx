// UF6004 props-not-object: the props type is a union of object types, whose members no target
// can declare as props; give the component one object type of props.
export type BadgeProps = { label: string } | { icon: string };

export default function Badge(props: BadgeProps) {
  return <span class="badge">badge</span>;
}
