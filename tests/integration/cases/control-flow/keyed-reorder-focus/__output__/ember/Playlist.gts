import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface Track {
  id: number;
  title: string;
  starred: boolean;
}

export interface PlaylistProps {
  initial: Track[];
}

export interface PlaylistSignature {
  Args: PlaylistProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class Playlist extends Component<PlaylistSignature> {
  sortByTitle = () => {
    this.tracks = this.tracks.toSorted((a, b) => a.title.localeCompare(b.title));
  };

  toggleStar = (id: number) => {
    this.tracks = this.tracks.map((track) =>
      track.id === id ? { ...track, starred: !track.starred } : track,
    );
  };

  @tracked tracks = this.args.initial;

  value1 = (track: NonNullable<this["tracks"]>[number]) =>
    track.starred ? `${track.title} (starred)` : track.title;

  value2 = (track: NonNullable<this["tracks"]>[number]) => `Star ${track.title}`;

  listener1 = (track: NonNullable<this["tracks"]>[number]) => () => this.toggleStar(track.id);

  <template><section
      class="playlist"
      style={{fallthroughStyle @style}}
      ...attributes
    ><ol
      aria-label="Playlist"
    >{{#each this.tracks key="id" as |track|}}<li><label><input
      type="checkbox"
      name="queued"
      value={{track.id}}
    >{{this.value1 track}}</label><button
      type="button"
      aria-pressed={{enumeratedValue track.starred}}
      {{on "click" (this.listener1 track)}}
    >{{this.value2 track}}</button></li>{{/each}}</ol><button
      type="button"
      {{on "click" this.sortByTitle}}
    >Sort by title</button></section></template>
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
