import { useRef, useState } from "react";
import type { MouseEvent } from "react";

import Base from "../../../../../integration/cases/fallthrough/dynamic-root-passthrough/__output__/react/Base";

export function Consumer() {
  const [clicks, setClicks] = useState(0);
  const base = useRef<HTMLAnchorElement | HTMLButtonElement>(null);
  const count = (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) =>
    setClicks(clicks + event.detail);
  return (
    <>
      <p id="docs-hint">Clicks {clicks}</p>
      <Base
        id="docs"
        ref={base}
        href="#docs"
        text="Docs"
        aria-describedby="docs-hint"
        data-testid="docs"
        onClick={count}
      />
      <button type="button" onClick={() => base.current?.focus()}>
        Focus
      </button>
    </>
  );
}
