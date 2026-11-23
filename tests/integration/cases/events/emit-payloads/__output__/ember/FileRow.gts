import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface FileInfo {
  path: string;
  size: number;
}

export interface FileRowProps {
  path: string;
  size: number;
}

export interface FileRowEvents {
  onRefresh?: () => void;
  onOpen?: (path: string) => void;
  onMove?: (from: string, to: string) => void;
  onPick?: (file: FileInfo) => void;
  onShare?: (path: string, note?: string) => void;
}

export interface FileRowSignature {
  Args: FileRowProps & { style?: unknown } & FileRowEvents;
  Element: HTMLElementTagNameMap["div"];
}

export default class FileRow extends Component<FileRowSignature> {
  archive = () => {
    this.args.onMove?.(this.args.path, `archive/${this.args.path}`);
    this.args.onRefresh?.();
  };

  listener1 = () => this.args.onRefresh?.();

  listener2 = () => this.args.onOpen?.(this.args.path);

  listener3 = () => this.args.onPick?.({ path: this.args.path, size: this.args.size });

  listener4 = () => this.args.onShare?.(this.args.path);

  listener5 = () => this.args.onShare?.(this.args.path, "Please review");

  <template><div
      class="file-row"
      role="group"
      aria-label={{@path}}
      style={{fallthroughStyle @style}}
      ...attributes
    ><span>{{@path}} ({{@size}} bytes)</span><button
      type="button"
      {{on "click" this.listener1}}
    >Refresh</button><button type="button" {{on "click" this.listener2}}>Open</button><button
      type="button"
      {{on "click" this.archive}}
    >Archive</button><button type="button" {{on "click" this.listener3}}>Select</button><button
      type="button"
      {{on "click" this.listener4}}
    >Share</button><button type="button" {{on "click" this.listener5}}>Share with a note</button></div></template>
}

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
