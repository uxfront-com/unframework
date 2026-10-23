import { ref } from "unframework";

import Badge from "./Badge.uf.tsx";
import Tag from "./Tag.uf.tsx";

type NoticeLook = {
  color?: string;
  backgroundColor?: string;
  borderLeft?: string;
  "--notice-accent"?: string;
};

// Only custom properties: React's `CSSProperties` declares none.
type NoticeVars = {
  "--notice-gap"?: string;
};

export interface NoticeProps {
  title: string;
  look?: NoticeLook;
  declarations?: string;
  vars?: NoticeVars;
}

export default function Notice({ title, look, declarations, vars }: NoticeProps) {
  const quiet = ref(false);

  function toggle() {
    quiet.value = !quiet.value;
  }

  return (
    <div class="notice">
      <p style={look}>{title}</p>
      <Badge
        label="Permanent"
        tone="padding: 2px 6px; color: rgb(120, 30, 30); outline: 1px solid"
        style={look}
      />
      <p style={declarations}>Read the details before you continue.</p>
      <component
        is={quiet.value ? Tag : Badge}
        label="Optional"
        tone="font-weight: 700"
        style={declarations}
      />
      <p
        style={
          quiet.value
            ? { color: "rgb(90, 90, 90)" }
            : { color: "var(--notice-accent, rgb(160, 40, 40))", fontWeight: "700" }
        }
      >
        This cannot be undone.
      </p>
      <button type="button" style={vars} onClick={toggle}>
        {quiet.value ? "Emphasise" : "Quieten"}
      </button>
    </div>
  );
}
