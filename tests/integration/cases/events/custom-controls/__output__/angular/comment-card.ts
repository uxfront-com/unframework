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
  selector: "uf-comment-card",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    @let currentLiked = this.currentLiked();
    <section
      class="comment-card"
      aria-label="Comment"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <label>Comment<textarea name="comment" rows="2" (input)="autosize($event)"></textarea></label>
      <div class="meter" role="presentation">
        <div class="fill" [style.width]="Math.min(text.length, 100) + '%'"></div>
      </div>
      <p>{{ text.length }} characters</p>
      <div
        class="like"
        role="button"
        tabindex="0"
        [attr.aria-pressed]="currentLiked"
        (click)="toggleLike($event)"
        (keydown)="onLikeKeydown($event)"
      >Like</div>
    </section>
  `,
})
export default class CommentCard {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly liked = output<[liked: boolean, by: string]>();
  protected readonly text = signal("");
  protected readonly currentLiked = signal(false);
  protected readonly Math = Math;

  protected autosize(event: Event) {
    const area = event.currentTarget as HTMLTextAreaElement;
    this.text.set(area.value);
    area.style.height = `${Math.max(area.value.split("\n").length, 2) * 1.5}em`;
  }

  protected toggleLike(event: MouseEvent | KeyboardEvent) {
    this.currentLiked.set(!this.currentLiked());
    this.liked.emit([this.currentLiked(), event.type]);
  }

  protected onLikeKeydown(event: KeyboardEvent) {
    if (event.key === " ") event.preventDefault();
    if (event.key === "Enter" || event.key === " ") this.toggleLike(event);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
