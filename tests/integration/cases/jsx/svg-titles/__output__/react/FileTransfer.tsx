import type { CSSProperties } from "react";

export interface FileTransferProps {
  fileName: string;
  percent: number;
  paused: boolean;
  eta?: string;
}

export interface FileTransferAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function FileTransfer({
  fileName,
  percent,
  paused,
  eta,
  className,
  style,
  ...attributes
}: FileTransferProps & FileTransferAttributes) {
  return (
    <div className={cx("file-transfer", className)} style={style} {...scopeAttributes(attributes)}>
      <svg className="file-transfer-progress" role="img" viewBox="0 0 36 36" width="36" height="36">
        <title>{`${fileName}: ${percent}% sent. ${eta ?? ""}`}</title>
        <circle cx="18" cy="18" r="16" fill="none" stroke="#0969da" strokeWidth="4" />
      </svg>
      <svg className="file-transfer-state" role="img" viewBox="0 0 16 16" width="16" height="16">
        <title>{paused ? "Transfer paused" : `Sending ${fileName}`}</title>
        <rect x="2" y="2" width="12" height="12" rx="2" fill="#1a7f37" />
      </svg>
    </div>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
