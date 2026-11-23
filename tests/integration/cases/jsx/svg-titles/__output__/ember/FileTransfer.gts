import type { TOC } from "@ember/component/template-only";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface FileTransferProps {
  fileName: string;
  percent: number;
  paused: boolean;
  eta?: string;
}

export interface FileTransferSignature {
  Args: FileTransferProps & { style?: unknown };
  Element: HTMLElementTagNameMap["div"];
}

const FileTransfer: TOC<FileTransferSignature> = <template><div
    class="file-transfer"
    style={{fallthroughStyle @style}}
    ...attributes
  ><svg
    class="file-transfer-progress"
    role="img"
    viewBox="0 0 36 36"
    width="36"
    height="36"
  ><title>{{@fileName}}: {{@percent}}% sent. {{@eta}}</title><circle
    cx="18"
    cy="18"
    r="16"
    fill="none"
    stroke="#0969da"
    stroke-width="4"
  /></svg><svg
    class="file-transfer-state"
    role="img"
    viewBox="0 0 16 16"
    width="16"
    height="16"
  ><title>{{#if @paused}}Transfer paused{{else}}Sending {{@fileName}}{{/if}}</title><rect
    x="2"
    y="2"
    width="12"
    height="12"
    rx="2"
    fill="#1a7f37"
  /></svg></div></template>;

export default FileTransfer;

/**
 * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
 * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
 * A style is text, or a list of `[property, value]` declarations, where one without a property
 * is a whole style.
 */
function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
  const merged = new Map<string, unknown>();
  const add = (style: unknown): void => {
    if (style === undefined || style === null) return;
    if (Array.isArray(style)) {
      for (const [property, value] of style as [string, unknown][]) {
        if (property) merged.set(property, value);
        else add(value);
      }
    } else if (typeof style === "object" && !isHTMLSafe(style)) {
      for (const [key, value] of Object.entries(style)) {
        merged.set(
          key.startsWith("--")
            ? key
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          value,
        );
      }
    } else {
      const text = String(style).replace(/\/\*[^]*?\*\//g, "");
      for (const declaration of text.split(/;(?![^(]*\))/)) {
        const [property, value] = declaration.split(/:([^]+)/);
        if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
      }
    }
  };
  for (const style of styles) add(style);
  const text = Array.from(merged)
    .flatMap(([property, value]) =>
      value === undefined || value === null ? [] : [`${property}: ${String(value)}`],
    )
    .join("; ");
  return text ? htmlSafe(text) : undefined;
}
