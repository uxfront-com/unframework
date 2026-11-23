import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface DeleteFileProps {
  fileName: string;
}

export interface DeleteFileEvents {
  onDeleted?: (fileName: string, copies: number) => void;
}

export interface DeleteFileSignature {
  Args: DeleteFileProps & { style?: unknown } & DeleteFileEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class DeleteFile extends Component<DeleteFileSignature> {
  requestDelete = async () => {
    this.confirming = true;
    await new Promise<void>((resolve) => {
      this.resolveConfirmation = resolve;
    });
    this.confirming = false;
    this.args.onDeleted?.(this.args.fileName, this.copies);
  };

  addCopy = () => {
    this.copies += 1;
  };

  confirmDelete = () => {
    this.resolveConfirmation?.();
  };

  @tracked copies = 1;

  @tracked confirming = false;

  resolveConfirmation: (() => void) | undefined;

  get value1() {
    return this.copies === 1 ? "copy" : "copies";
  }

  <template><section
      class="delete-file"
      aria-label="File"
      style={{fallthroughStyle @style}}
      ...attributes
    ><p>{{@fileName}}, {{this.copies}} {{this.value1}}</p><button
      type="button"
      {{on "click" this.addCopy}}
    >Add a copy</button>{{#if this.confirming}}<button
      type="button"
      {{on "click" this.confirmDelete}}
    >Confirm the deletion</button>{{else}}<button
      type="button"
      {{on "click" this.requestDelete}}
    >Delete</button>{{/if}}</section></template>
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
