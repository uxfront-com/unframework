import { ref, useTemplateRef } from "@uxfront/unframework";

import Base from "./Base.uf.tsx";
import Primary from "./Primary.uf.tsx";

export default function Page() {
  const linked = ref(true);
  const log = ref<string[]>([]);
  const direct = useTemplateRef<HTMLAnchorElement | HTMLButtonElement>();
  const chained = useTemplateRef<HTMLAnchorElement | HTMLButtonElement>();

  function record(line: string) {
    log.value = [...log.value, line];
  }

  return (
    <section aria-label="Page">
      <Base
        href={linked.value ? "#direct" : undefined}
        text="Direct"
        id="direct"
        aria-label="Direct"
        data-testid="direct"
        title="Go"
        onClick={(event) => record(`click on ${(event.currentTarget as Element).localName}`)}
        onKeydown={(event) =>
          record(`keydown ${event.key} on ${(event.currentTarget as Element).localName}`)
        }
        ref={direct}
      />
      <Primary
        href={linked.value ? "#chained" : undefined}
        text="Chained"
        id="chained"
        aria-label="Chained"
        data-testid="chained"
        onClick={(event) => record(`chained on ${(event.currentTarget as Element).localName}`)}
        ref={chained}
      />
      <button type="button" onClick={() => (linked.value = !linked.value)}>
        Toggle
      </button>
      <button type="button" onClick={() => direct.value?.focus()}>
        Focus direct
      </button>
      <button type="button" onClick={() => chained.value?.focus()}>
        Focus chained
      </button>
      <ol aria-label="Log">
        {log.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
