import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { capabilities, setModifierManager } from "@ember/modifier";
import type { ModifierLike } from "@glint/template";

export interface CommandMenuProps {
  commands: string[];
}

export interface CommandMenuEvents {
  onRun?: (command: string) => void;
  onDismiss?: () => void;
}

export interface CommandMenuSignature {
  Args: CommandMenuProps & { style?: unknown } & CommandMenuEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class CommandMenu extends Component<CommandMenuSignature> {
  handleKey = (event: KeyboardEvent) => {
    if (event.key === "Enter") event.preventDefault();
    if (event.key === "ArrowDown") {
      this.active = (this.active + 1) % this.args.commands.length;
    } else if (event.key === "ArrowUp") {
      this.active = (this.active + this.args.commands.length - 1) % this.args.commands.length;
    } else if (event.key === "Enter") {
      this.args.onRun?.(this.args.commands[this.active] ?? this.query);
    } else if (event.key === "Escape") {
      this.active = 0;
      this.args.onDismiss?.();
    }
  };

  clearShortcut = () => {
    const input = this.shortcutField;
    if (input) input.value = "";
  };

  @tracked active = 0;

  @tracked query = "";

  @tracked shortcutField: HTMLInputElement | null = null;

  listener1 = (event: HTMLElementEventMap["input"]) =>
    (this.query = (event.currentTarget as HTMLInputElement).value);

  value1 = (index: number) => (index === this.active ? "true" : undefined);

  listener2 = (event: HTMLElementEventMap["keydown"]) =>
    event.key === "Escape" && this.clearShortcut();

  <template><section
      class="command-menu"
      aria-label="Command menu"
      style={{fallthroughStyle @style}}
      ...attributes
    ><form
      role="search"
      aria-label="Commands"
    ><label>Command<input
      name="command"
      {{on "input" this.listener1}}
      {{on "keydown" this.handleKey}}
    ></label></form><ul
      aria-label="Suggestions"
    >{{#each @commands key="@identity" as |command index|}}<li
      aria-current={{enumeratedValue (this.value1 index)}}
    >{{command}}</li>{{/each}}</ul><label>Shortcut name<input
      name="shortcut"
      {{templateRef this "shortcutField"}}
      {{on "keydown" this.listener2}}
    ></label></section></template>
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
