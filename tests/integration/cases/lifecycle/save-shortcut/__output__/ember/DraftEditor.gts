import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { isDestroying, registerDestructor } from "@ember/destroyable";
import { renderSettled } from "@ember/renderer";

export interface DraftEditorEvents {
  onSaved?: (count: number) => void;
}

export interface DraftEditorSignature {
  Args: { style?: unknown } & DraftEditorEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class DraftEditor extends Component<DraftEditorSignature> {
  onShortcut = (event: KeyboardEvent) => {
    if (event.key !== "s" || !event.ctrlKey) return;
    event.preventDefault();
    this.saves += 1;
    this.args.onSaved?.(this.saves);
  };

  @tracked saves = 0;

  #mounted = false;

  /** Called at the template's end: the hooks run once the component has rendered. */
  onMounted = (): undefined => {
    if (!this.#mounted) {
      this.#mounted = true;
      afterRender(this, () => {
        document.addEventListener("keydown", this.onShortcut);
      });
      afterRender(this, () =>
        registerDestructor(this, () => {
          document.removeEventListener("keydown", this.onShortcut);
        }),
      );
    }
    return undefined;
  };

  <template><section
      class="draft-editor"
      aria-label="Draft"
      style={{fallthroughStyle @style}}
      ...attributes
    ><label>Draft<textarea name="draft"></textarea></label><p
      role="status"
    >Saved: {{this.saves}}</p></section>{{(this.onMounted)}}</template>
}

/** Runs `run` once the render settles, unless its component is gone by then. */
function afterRender(owner: object, run: () => unknown): void {
  // A component on the server never mounts, as Vue registers no hook in a server render.
  if (import.meta.env.SSR) return;
  void renderSettled().then(() => {
    if (!isDestroying(owner)) void run();
  });
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
