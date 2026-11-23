import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import ConfirmDialog, { type ConfirmDialogEvents } from "./ConfirmDialog.gts";

export interface FilesProps {
  file: string;
}

export interface FilesEvents {
  onDelete?: (file: string) => void;
}

export interface FilesSignature {
  Args: FilesProps & { style?: unknown } & FilesEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class Files extends Component<FilesSignature> {
  confirm = () => {
    this.open = false;
    this.args.onDelete?.(this.args.file);
  };

  @tracked open = false;

  listener1 = () => (this.open = true);

  get value1() {
    return `Delete ${this.args.file}?`;
  }

  listener2 = (() => (this.open = false)) satisfies NonNullable<ConfirmDialogEvents["onClose"]>;

  <template><section
      class="files"
      aria-label="Files"
      style={{fallthroughStyle @style}}
      ...attributes
    ><p>{{@file}}</p><button type="button" {{on "click" this.listener1}}>Delete {{@file}}</button>{{#if this.open}}{{#let (teleportTarget "body") as |target|}}{{#if target}}{{#in-element target insertBefore=null}}<div
      data-teleported="true"
      class="backdrop"
    ><ConfirmDialog
      @title={{this.value1}}
      @onConfirm={{this.confirm}}
      @onClose={{this.listener2}}
    /></div>{{/in-element}}{{/if}}{{/let}}{{/if}}</section></template>
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

/** The element a `<Teleport to>` selects, in the browser only: the server renders no teleport. */
function teleportTarget(to: string): Element | undefined {
  return import.meta.env.SSR ? undefined : (document.querySelector(to) ?? undefined);
}
