import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

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

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

/**
 * Puts what a consumer passes the component, and the component does not declare, on the element
 * that takes it (ADR-0118): the attributes, the consumer's winning over the element's own, and
 * the native listeners, which run after the element's own.
 */
@Directive({ selector: "[ufFallthrough]" })
export class Fallthrough implements OnChanges, OnDestroy {
  readonly ufFallthrough = input.required<{
    attributes: Record<string, unknown> | undefined;
    listeners: Listeners | undefined;
  }>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly listening = new Map<string, { handler: unknown; stop: () => void }>();
  private written: Record<string, unknown> = {};

  ngOnChanges(): void {
    const element = this.element.nativeElement;
    const { attributes = {}, listeners = {} } = this.ufFallthrough();
    for (const name of Object.keys(this.written)) {
      if (!(name in attributes)) this.renderer.removeAttribute(element, name);
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) this.renderer.removeAttribute(element, name);
      else this.renderer.setAttribute(element, name, String(value));
    }
    this.written = attributes;
    if (!this.browser) return;
    const handlers = new Map(Object.entries(listeners));
    for (const [event, { handler, stop }] of this.listening) {
      if (handlers.get(event) === handler) continue;
      stop();
      this.listening.delete(event);
    }
    for (const [event, handler] of handlers) {
      if (handler === undefined || this.listening.has(event)) continue;
      this.listening.set(event, { handler, stop: this.renderer.listen(element, event, handler) });
    }
  }

  ngOnDestroy(): void {
    for (const { stop } of this.listening.values()) stop();
  }
}

@Component({
  selector: "uf-meeting-list",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let organiser = this.organiser();
    @let rooms = this.rooms();
    @let log = this.log();
    @let lastKey = this.lastKey();
    @let clicks = this.clicks();
    @let upcoming = this.upcoming();
    <section
      class="meeting-list"
      aria-label="Meetings"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <ul aria-label="Upcoming">
        @for (event of upcoming; track event.id) {
          <li>
            <button
              type="button"
              (click)="show(event); void (once(clickOnce, $event) && opened.emit(event.title))"
            >{{ event.title }}</button>
          </li>
        }
      </ul>
      <ul aria-label="Rooms">
        @for (room of rooms; track room) {
          <li>
            <button
              type="button"
              (click)="record('pick ' + room); void (once(clickOnce, $event) && book(room))"
            >{{ room }}</button>
          </li>
        }
      </ul>
      @if (organiser) {
        <button
          type="button"
          (click)="record('thank ' + organiser.name); void (once(clickOnce, $event) && thanked.emit(organiser.name))"
        >{{ "Thank " + organiser.name }}</button>
      } @else {
        <p>No organiser</p>
      }
      <button
        type="button"
        (click)="onTrack(); void (once(clickOnce, $event) && onTrackOnce())"
      >Track</button>
      <p>Clicks: {{ clicks }}</p>
      <label>Filter<input name="filter" (keydown)="onFilterKeydown($event)" /></label>
      <p>Last key: {{ lastKey }}</p>
      <ol aria-label="Log">
        @for (line of log; track index; let index = $index) {
          <li>{{ line }}</li>
        }
      </ol>
    </section>
  `,
})
export default class MeetingList {
  readonly meetings = input.required<Meeting[]>();
  readonly organiser = input<Organiser>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly opened = output<string>();
  readonly thanked = output<string>();
  readonly track = output<[name: string, count: number]>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly rooms = signal(["Atlas", "Borealis"]);
  protected readonly log = signal<string[]>([]);
  protected readonly lastKey = signal("none");
  protected readonly clicks = signal(0);
  protected readonly upcoming = computed(() => this.meetings().filter((meeting) => !meeting.done));
  protected readonly clickOnce = new WeakSet<EventTarget>();

  protected record(line: string) {
    this.log.set([...this.log(), line]);
  }

  protected show(meeting: Meeting) {
    this.record(`show ${meeting.title}`);
  }

  protected async book(room: string) {
    await Promise.resolve();
    this.record(`booked ${room}`);
  }

  private remember(key: string): boolean {
    this.lastKey.set(key);
    return key === "Enter";
  }

  protected onTrack() {
    this.clicks.update((clicks) => clicks + 1);
  }

  protected onTrackOnce() {
    const event = "first-click";
    this.track.emit([event, this.clicks()]);
  }

  protected onFilterKeydown(event: KeyboardEvent) {
    if (event.altKey) return;
    this.remember(event.key);
  }

  protected once(elements: WeakSet<EventTarget>, event: Event): boolean {
    const element = event.currentTarget;
    if (element === null || elements.has(element)) return false;
    elements.add(element);
    return true;
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
