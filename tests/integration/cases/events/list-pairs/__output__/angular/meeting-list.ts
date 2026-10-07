import { Component, computed, input, output, signal } from "@angular/core";

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

@Component({
  selector: "uf-meeting-list",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let organiser = this.organiser();
    @let rooms = this.rooms();
    @let log = this.log();
    @let lastKey = this.lastKey();
    @let clicks = this.clicks();
    @let upcoming = this.upcoming();
    <section class="meeting-list" aria-label="Meetings">
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
  readonly opened = output<string>();
  readonly thanked = output<string>();
  readonly track = output<[name: string, count: number]>();
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
}
