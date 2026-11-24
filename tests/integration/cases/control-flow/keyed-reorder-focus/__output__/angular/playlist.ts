import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  type OnInit,
  inject,
  input,
  linkedSignal,
  untracked,
  viewChild,
} from "@angular/core";

export interface Track {
  id: number;
  title: string;
  starred: boolean;
}

export interface PlaylistProps {
  initial: Track[];
}

@Component({
  selector: "uf-playlist",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let tracks = this.tracks();
    <section
      class="playlist"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <ol aria-label="Playlist">
        @for (track of tracks; track track.id) {
          <li>
            <label><input type="checkbox" name="queued" [attr.value]="track.id" />{{ track.starred ? track.title + " (starred)" : track.title }}</label>
            <button
              type="button"
              [attr.aria-pressed]="track.starred"
              (click)="toggleStar(track.id)"
            >{{ "Star " + track.title }}</button>
          </li>
        }
      </ol>
      <button type="button" (click)="sortByTitle()">Sort by title</button>
    </section>
  `,
})
export default class Playlist implements OnInit {
  readonly initial = input.required<Track[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly tracks = linkedSignal(() => untracked(() => this.initial()));

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.tracks();
  }

  protected sortByTitle() {
    this.tracks.set(this.tracks().toSorted((a, b) => a.title.localeCompare(b.title)));
  }

  protected toggleStar(id: number) {
    this.tracks.set(
      this.tracks().map((track) =>
        track.id === id ? { ...track, starred: !track.starred } : track,
      ),
    );
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
