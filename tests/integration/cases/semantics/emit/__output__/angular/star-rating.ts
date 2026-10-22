import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

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
  selector: "uf-star-rating",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let stars = this.stars();
    <div
      class="star-rating"
      role="group"
      aria-label="Rating"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <ul>
        @for (choice of choices; track choice) {
          <li>
            <button
              type="button"
              [attr.aria-pressed]="stars >= choice"
              (click)="choose(choice)"
            >{{ choice }}&ngsp;{{ choice === 1 ? "star" : "stars" }}</button>
          </li>
        }
      </ul>
      <p role="status">{{ stars }} of 5</p>
      <button type="button" (click)="clear()">Clear</button>
    </div>
  `,
})
export default class StarRating {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly preview = output<number>();
  readonly rate = output<[stars: number, previous: number]>();
  readonly cleared = output<void>();
  protected readonly choices = [1, 2, 3, 4, 5];
  protected readonly stars = signal(0);

  protected choose(next: number) {
    const previous = this.stars();
    this.preview.emit(next);
    this.stars.set(next);
    this.rate.emit([this.stars(), previous]);
  }

  protected clear() {
    for (let star = this.stars() - 1; star >= 0; star--) {
      this.preview.emit(star);
    }
    this.stars.set(0);
    this.cleared.emit();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
