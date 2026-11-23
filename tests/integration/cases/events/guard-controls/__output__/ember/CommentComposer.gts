import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface CommentComposerEvents {
  onSent?: (text: string) => void;
  onSaved?: (count: number) => void;
  onFirstSave?: () => void;
}

export interface CommentComposerSignature {
  Args: { style?: unknown } & CommentComposerEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class CommentComposer extends Component<CommentComposerSignature> {
  record = (line: string) => {
    this.log = [...this.log, line];
  };

  send = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    this.args.onSent?.((event.target as HTMLTextAreaElement).value);
  };

  addTag = (event: KeyboardEvent) => {
    event.preventDefault();
    const field = event.target as HTMLInputElement;
    if (field.value === "" || this.tags.includes(field.value)) return;
    this.tags = [...this.tags, field.value];
    field.value = "";
  };

  clearSearch = (event: KeyboardEvent) => {
    event.stopPropagation();
    this.query = "";
    (event.target as HTMLInputElement).value = "";
  };

  dismiss = (event: MouseEvent) => {
    event.stopPropagation();
    this.confirming = false;
    this.record("dismissed");
  };

  @tracked tags: string[] = [];

  @tracked query = "";

  @tracked panelOpen = true;

  @tracked confirming = true;

  @tracked tipShown = true;

  @tracked saves = 0;

  @tracked log: string[] = [];

  finishUpload: (() => void) | undefined;

  listener1 = (event: HTMLElementEventMap["keydown"]) => {
    if (event.key !== "Enter") return;
    this.addTag(event);
  };

  listener2 = (event: HTMLElementEventMap["submit"]) => {
    event.preventDefault();
    this.record("tags submitted");
  };

  listener3 = (event: HTMLElementEventMap["keydown"]) => {
    if (event.key.length === 1 && (event.target as HTMLInputElement).value.length >= 4)
      event.preventDefault();
  };

  listener4 = (event: HTMLElementEventMap["input"]) =>
    (this.query = (event.currentTarget as HTMLInputElement).value);

  listener5 = (event: HTMLElementEventMap["keydown"]) => {
    if (event.key === "Escape" && (event.target as HTMLInputElement).value !== "")
      this.clearSearch(event);
  };

  get value1() {
    return this.panelOpen ? `Searching for: ${this.query}` : "Panel closed";
  }

  listener6 = (event: HTMLElementEventMap["keydown"]) => {
    if (event.key === "Escape") this.panelOpen = false;
  };

  listener7 = () => this.record("tip button");

  listener8 = (event: HTMLElementEventMap["click"]) => {
    if (!this.tipShown) return;
    if (event.target !== event.currentTarget) return;
    event.stopPropagation();
    this.tipShown = false;
  };

  listener9 = () => this.record("kept");

  listener10 = (event: HTMLElementEventMap["click"]) => {
    if (event.target === event.currentTarget) this.dismiss(event);
  };

  listener11 = () => this.record("page");

  listener12 = () => {
    if (this.tags.length === 0) return;
    this.saves += 1;
    this.args.onSaved?.(this.saves);
  };

  listener13 = () => this.args.onFirstSave?.();

  listener14 = async () => {
    this.record("upload started");
    await new Promise<void>((resolve) => {
      this.finishUpload = resolve;
    });
    this.record("upload finished");
  };

  listener15 = () => this.record("first upload");

  listener16 = () => this.finishUpload?.();

  <template><section
      class="comment-composer"
      aria-label="Composer"
      style={{fallthroughStyle @style}}
      ...attributes
    ><label>Comment<textarea name="comment" {{on "keydown" this.send}}></textarea></label><form
      aria-label="Tags"
      {{on "submit" this.listener2}}
    ><label>Tag<input name="tag" {{on "keydown" this.listener1}}></label><button
      type="submit"
    >Save tags</button></form><ul
      aria-label="Tag list"
    >{{#each this.tags key="@identity" as |tag|}}<li>{{tag}}</li>{{/each}}</ul><label>Code<input
      name="code"
      {{on "keydown" this.listener3}}
    ></label><div
      class="panel"
      role="presentation"
      {{on "keydown" this.listener6}}
    ><label>Search<input
      name="search"
      {{on "input" this.listener4}}
      {{on "keydown" this.listener5}}
    ></label><p>{{this.value1}}</p></div><div
      class="page"
      role="presentation"
      {{on "click" this.listener11}}
    >{{#if this.tipShown}}<div
      class="tip"
      role="presentation"
      style="padding: 12px"
      {{on "click" this.listener8}}
    >Click here to hide this tip.<button
      type="button"
      {{on "click" this.listener7}}
    >More tips</button></div>{{/if}}{{#if this.confirming}}<div
      class="backdrop"
      role="presentation"
      data-testid="backdrop"
      style="padding: 24px"
      {{on "click" this.listener10}}
    ><div
      role="dialog"
      aria-label="Discard draft"
    ><p>Discard this draft?</p><button type="button" {{on "click" this.listener9}}>Keep</button></div></div>{{else}}<p>Draft dismissed</p>{{/if}}</div><button
      type="button"
      {{on "click" this.listener12}}
      {{on "click" this.listener13 once=true}}
    >Save</button><button
      type="button"
      {{on "click" this.listener14}}
      {{on "click" this.listener15 once=true}}
    >Upload</button><button type="button" {{on "click" this.listener16}}>Finish upload</button><ol
      aria-label="Log"
    >{{#each this.log key="@index" as |line|}}<li>{{line}}</li>{{/each}}</ol></section></template>
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
