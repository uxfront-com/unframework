import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface Settings {
  theme: string;
  size: number;
}

interface SaveReply {
  id?: number;
  error?: string;
}

export interface DisplaySettingsEvents {
  onApplied?: (theme: string, size: number) => void;
  onSaved?: (id: number) => void;
}

export interface DisplaySettingsSignature {
  Args: { style?: unknown } & DisplaySettingsEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class DisplaySettings extends Component<DisplaySettingsSignature> {
  apply = (patch: Partial<Settings>) => {
    const { theme = this.settings.theme, size = this.settings.size } = patch;
    this.settings = { theme, size };
    this.args.onApplied?.(theme, size);
  };

  grow = () => {
    const clamp = (value: number, max = this.maxSize) => Math.min(value, max);
    this.apply({ size: clamp(this.settings.size + 4) });
  };

  save = async () => {
    this.saving = true;
    this.failure = "";
    try {
      const reply = await new Promise<SaveReply>((resolve) => {
        this.finish = resolve;
      });
      if (reply.error) throw new Error(reply.error);
      const id = reply.id ?? 0;
      this.label = id === 0 ? "Saved as a draft" : `Saved as #${id}`;
      this.args.onSaved?.(id);
    } catch (error) {
      this.failure = error instanceof Error ? error.message : "Saving failed";
    } finally {
      this.saving = false;
    }
  };

  @tracked settings: Settings = { theme: "light", size: 14 };

  @tracked maxSize = 20;

  @tracked saving = false;

  @tracked label = "Never saved";

  @tracked failure = "";

  finish: ((reply: SaveReply) => void) | undefined;

  listener1 = () => this.apply({ theme: "dark" });

  listener2 = () => (this.maxSize = 30);

  get value1() {
    return this.saving ? "Saving" : this.failure === "" ? this.label : `Failed: ${this.failure}`;
  }

  listener3 = () => this.finish?.({ id: 7 });

  listener4 = () => this.finish?.({});

  listener5 = () => this.finish?.({ error: "Disk full" });

  <template><section
      class="display-settings"
      aria-label="Display"
      style={{fallthroughStyle @style}}
      ...attributes
    ><p role="status">Theme {{this.settings.theme}}, size {{this.settings.size}}</p><button
      type="button"
      {{on "click" this.listener1}}
    >Dark</button><button type="button" {{on "click" this.grow}}>Larger</button><button
      type="button"
      {{on "click" this.listener2}}
    >Allow up to 30</button><button type="button" {{on "click" this.save}}>Save</button><p>{{this.value1}}</p><div
      role="group"
      aria-label="Server"
    ><button type="button" {{on "click" this.listener3}}>Reply with an id</button><button
      type="button"
      {{on "click" this.listener4}}
    >Reply as a draft</button><button
      type="button"
      {{on "click" this.listener5}}
    >Reply with an error</button></div></section></template>
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
