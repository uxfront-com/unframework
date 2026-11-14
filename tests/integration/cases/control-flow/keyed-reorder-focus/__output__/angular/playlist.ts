import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  linkedSignal,
  untracked,
} from "@angular/core";

export interface Track {
  id: number;
  title: string;
  starred: boolean;
}

export interface PlaylistProps {
  initial: Track[];
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

@Component({
  selector: "uf-playlist",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let tracks = this.tracks();
    <section class="playlist" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
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
