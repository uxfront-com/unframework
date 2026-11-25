import { useTemplateRef } from "@uxfront/unframework";

import Bio from "./Bio.uf.tsx";
import NameField from "./NameField.uf.tsx";

export default function Profile() {
  const name = useTemplateRef<HTMLInputElement>();
  const bio = useTemplateRef<HTMLInputElement>();
  return (
    <form aria-label="Profile">
      <NameField ref={name} label="Name" />
      <button type="button" onClick={() => name.value?.focus()}>
        Edit name
      </button>
      <Bio ref={bio} label="Bio" />
      <button type="button" onClick={() => bio.value?.focus()}>
        Edit bio
      </button>
    </form>
  );
}
