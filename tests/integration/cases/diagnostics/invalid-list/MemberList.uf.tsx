// UF3015 invalid-list: a `.map` callback that destructures its item, outside the canonical
// `(item, index) => <element key={…}>` form.
export interface Member {
  id: string;
  name: string;
}

export interface MemberListProps {
  members: Member[];
}

export default function MemberList({ members }: MemberListProps) {
  return (
    <ul>
      {members.map(({ id, name }) => (
        <li key={id}>{name}</li>
      ))}
    </ul>
  );
}
