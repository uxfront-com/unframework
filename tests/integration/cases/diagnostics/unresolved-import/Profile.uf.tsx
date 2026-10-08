// UF1202 unresolved-import: no component module is at the specifier, so the compiler cannot read
// what the imported component declares (ADR-0053).
import Avatar from "./Avatar.uf.tsx";

export default function Profile({ name }: { name: string }) {
  return (
    <div class="profile">
      <Avatar />
      <p>{name}</p>
    </div>
  );
}
