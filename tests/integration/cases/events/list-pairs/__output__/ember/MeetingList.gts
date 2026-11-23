import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface Meeting {
  id: number;
  title: string;
  done: boolean;
}

export interface Organiser {
  name: string;
}

export interface MeetingListProps {
  meetings: Meeting[];
  organiser?: Organiser;
}

export interface MeetingListEvents {
  onOpened?: (title: string) => void;
  onThanked?: (name: string) => void;
  onTrack?: (name: string, count: number) => void;
}

export interface MeetingListSignature {
  Args: MeetingListProps & { style?: unknown } & MeetingListEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class MeetingList extends Component<MeetingListSignature> {
  record = (line: string) => {
    this.log = [...this.log, line];
  };

  show = (meeting: Meeting) => {
    this.record(`show ${meeting.title}`);
  };

  book = async (room: string) => {
    await Promise.resolve();
    this.record(`booked ${room}`);
  };

  remember = (key: string): boolean => {
    this.lastKey = key;
    return key === "Enter";
  };

  @tracked rooms = ["Atlas", "Borealis"];

  @tracked log: string[] = [];

  @tracked lastKey = "none";

  @tracked clicks = 0;

  get upcoming() {
    return this.args.meetings.filter((meeting) => !meeting.done);
  }

  listener1 = (event: NonNullable<this["upcoming"]>[number]) => () => this.show(event);

  listener2 = (event: NonNullable<this["upcoming"]>[number]) => () =>
    this.args.onOpened?.(event.title);

  listener3 = (room: NonNullable<this["rooms"]>[number]) => () => this.record(`pick ${room}`);

  listener4 = (room: NonNullable<this["rooms"]>[number]) => async () => this.book(room);

  get value1() {
    return this.args.organiser ? `Thank ${this.args.organiser.name}` : undefined;
  }

  listener5 = () => {
    if (!this.args.organiser) return;
    return this.record(`thank ${this.args.organiser.name}`);
  };

  listener6 = () => {
    if (!this.args.organiser) return;
    return this.args.onThanked?.(this.args.organiser.name);
  };

  listener7 = () => (this.clicks += 1);

  listener8 = () => {
    const event = "first-click";
    this.args.onTrack?.(event, this.clicks);
  };

  listener9 = (event: HTMLElementEventMap["keydown"]) => {
    if (event.altKey) return false;
    return this.remember(event.key);
  };

  <template><section
      class="meeting-list"
      aria-label="Meetings"
      style={{fallthroughStyle @style}}
      ...attributes
    ><ul
      aria-label="Upcoming"
    >{{#each this.upcoming key="id" as |event|}}<li><button
      type="button"
      {{on "click" (this.listener1 event)}}
      {{on "click" (this.listener2 event) once=true}}
    >{{event.title}}</button></li>{{/each}}</ul><ul
      aria-label="Rooms"
    >{{#each this.rooms key="@identity" as |room|}}<li><button
      type="button"
      {{on "click" (this.listener3 room)}}
      {{on "click" (this.listener4 room) once=true}}
    >{{room}}</button></li>{{/each}}</ul>{{#if @organiser}}<button
      type="button"
      {{on "click" this.listener5}}
      {{on "click" this.listener6 once=true}}
    >{{this.value1}}</button>{{else}}<p>No organiser</p>{{/if}}<button
      type="button"
      {{on "click" this.listener7}}
      {{on "click" this.listener8 once=true}}
    >Track</button><p>Clicks: {{this.clicks}}</p><label>Filter<input
      name="filter"
      {{on "keydown" this.listener9}}
    ></label><p>Last key: {{this.lastKey}}</p><ol
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
