import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface NoteEditorEvents {
  onSaved?: (title: string, bold: boolean) => void;
}

export interface NoteEditorSignature {
  Args: { style?: unknown } & NoteEditorEvents;
  Element: HTMLElementTagNameMap["form"];
}

export default class NoteEditor extends Component<NoteEditorSignature> {
  save = () => {
    this.saves += 1;
    this.args.onSaved?.(this.title, this.bold);
  };

  @tracked title = "";

  @tracked bold = false;

  @tracked saves = 0;

  listener1 = (event: HTMLElementEventMap["input"]) =>
    (this.title = (event.currentTarget as HTMLInputElement).value);

  listener2 = (event: HTMLElementEventMap["mousedown"]) => event.preventDefault();

  listener3 = () => (this.bold = !this.bold);

  listener4 = (event: HTMLElementEventMap["submit"]) => event.preventDefault();

  <template><form
      class="note-editor"
      aria-label="Note"
      {{on "submit" this.listener4}}
      style={{fallthroughStyle @style}}
      ...attributes
    ><label>Title<input name="title" {{on "input" this.listener1}}></label><label>Text<textarea
      name="text"
    ></textarea></label><div
      class="format"
      role="group"
      aria-label="Format"
    ><button
      type="button"
      aria-pressed={{enumeratedValue this.bold}}
      {{on "mousedown" this.listener2}}
      {{on "click" this.listener3}}
    >Bold</button></div><button type="submit" {{on "click" this.save}}>Save</button><p
      role="status"
    >Saves: {{this.saves}}</p></form></template>
}

/** An enumerated attribute's value: a boolean as its name, any other value as it is. */
function enumeratedValue<T>(value: T): Exclude<T, boolean> | "true" | "false" {
  return typeof value === "boolean"
    ? (String(value) as "true" | "false")
    : (value as Exclude<T, boolean>);
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
