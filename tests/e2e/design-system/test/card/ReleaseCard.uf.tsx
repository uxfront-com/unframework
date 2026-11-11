// A harness parent (ADR-0057): `mount` takes props but no slots, and the card shows only what
// its slots hold.
import Card from "../../src/Card.uf.tsx";

export default function ReleaseCard({ author }: { author: string }) {
  return (
    <Card>
      {{
        header: () => <h2>Release notes</h2>,
        default: () => <p>Tests run on every target.</p>,
        footer: () => <small>By {author}</small>,
      }}
    </Card>
  );
}
