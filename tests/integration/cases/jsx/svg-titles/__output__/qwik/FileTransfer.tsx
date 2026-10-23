import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface FileTransferProps {
  fileName: string;
  percent: number;
  paused: boolean;
  eta?: string;
}

export default component$<FileTransferProps & { class?: ClassList; style?: CSSProperties }>(
  ({ fileName, percent, paused, eta, class: className, style, ...attributes }) => {
    return (
      <div class={["file-transfer", className]} {...scopeAttributes(attributes)} style={style}>
        <svg class="file-transfer-progress" role="img" viewBox="0 0 36 36" width="36" height="36">
          <title>{`${fileName}: ${percent}% sent. ${eta ?? ""}`}</title>
          <circle cx="18" cy="18" r="16" fill="none" stroke="#0969da" stroke-width="4" />
        </svg>
        <svg class="file-transfer-state" role="img" viewBox="0 0 16 16" width="16" height="16">
          <title>{paused ? "Transfer paused" : `Sending ${fileName}`}</title>
          <rect x="2" y="2" width="12" height="12" rx="2" fill="#1a7f37" />
        </svg>
      </div>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
