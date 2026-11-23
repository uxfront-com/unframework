import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { capabilities, setModifierManager } from "@ember/modifier";
import type { ModifierLike } from "@glint/template";

export interface NoteEditorEvents {
  onSaved?: (count: number) => void;
  onTagged?: (tag: string, via: string) => void;
}

export interface NoteEditorSignature {
  Args: { style?: unknown } & NoteEditorEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class NoteEditor extends Component<NoteEditorSignature> {
  save = () => {
    this.saves += 1;
    this.args.onSaved?.(this.saves);
  };

  recordKey = (event: KeyboardEvent) => {
    this.lastKey = event.key;
  };

  addTag = (event: MouseEvent | KeyboardEvent) => {
    if (this.tag === "") return;
    this.tags = [...this.tags, this.tag];
    this.args.onTagged?.(this.tag, event.type);
    this.tag = "";
    if (this.tagField) this.tagField.value = "";
  };

  onTagKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter") this.addTag(event);
  };

  @tracked saves = 0;

  @tracked lastKey = "none";

  @tracked tags: string[] = [];

  @tracked tag = "";

  @tracked tagField: HTMLInputElement | null = null;

  listener1 = (event: HTMLElementEventMap["input"]) =>
    (this.tag = (event.currentTarget as HTMLInputElement).value);

  get value1() {
    return this.tags.join(", ");
  }

  <template><section
      class="note-editor"
      aria-label="Note"
      style={{fallthroughStyle @style}}
      ...attributes
    ><button type="button" {{on "click" this.save}}>Save</button><label>Title<input
      name="title"
      {{on "keydown" this.recordKey}}
    ></label><label>Body<textarea name="body" {{on "keydown" this.recordKey}}></textarea></label><p
      role="status"
    >Saved {{this.saves}} times, last key {{this.lastKey}}</p><button
      type="button"
      {{on "click" this.save}}
    >Save and close</button><label>Tag<input
      {{templateRef this "tagField"}}
      name="tag"
      {{on "input" this.listener1}}
      {{on "keydown" this.onTagKeydown}}
    ></label><button type="button" {{on "click" this.addTag}}>Add tag</button><p>Tags: {{this.value1}}</p></section></template>
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

/** A modifier that sets a member of its component to its element while the element is rendered. */
const templateRef = setModifierManager(
  () => ({
    capabilities: capabilities("3.22"),
    createModifier: () => ({}),
    installModifier(
      _state: object,
      element: Element,
      { positional }: { positional: readonly unknown[] },
    ) {
      Reflect.set(positional[0] as object, positional[1] as string, element);
    },
    updateModifier() {},
    destroyModifier(_state: object, { positional }: { positional: readonly unknown[] }) {
      Reflect.set(positional[0] as object, positional[1] as string, null);
    },
  }),
  {},
) as unknown as ModifierLike<{
  Element: Element;
  Args: { Positional: [owner: object, name: string] };
}>;
