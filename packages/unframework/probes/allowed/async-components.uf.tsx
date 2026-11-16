// An async component, whose setup awaits (ADR-0101), is written as a tag like any other.
import { ref } from "@uxfront/unframework";

async function loadName(id: string): Promise<string> {
  return id;
}

async function Profile({ id }: { id: string }) {
  const name = await loadName(id);
  const visits = ref(0);
  return (
    <p>
      {name} {visits.value}
    </p>
  );
}

export function Page() {
  return (
    <main>
      <Profile id="ada" />
    </main>
  );
}
