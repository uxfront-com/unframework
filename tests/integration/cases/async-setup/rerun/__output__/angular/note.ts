import { loadUser } from "./api";
import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  Injector,
  type OnInit,
  PendingTasks,
  Renderer2,
  afterNextRender,
  inject,
  input as input_1,
  output,
  signal,
  viewChild,
} from "@angular/core";

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input_1.required<HTMLElement>();
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
  selector: "uf-note",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @if (resolved()) {
      <form
        class="note"
        aria-label="Note"
        [class]="this.class()"
        [style]="this.style()"
        [ufScope]="this.host"
      >
        <label>Note for {{ user.name }}&ngsp;<input #input type="text" /></label>
      </form>
    }
  `,
})
export default class Note implements OnInit {
  readonly id = input_1.required<string>();
  readonly class = input_1<string>();
  readonly style = input_1<Record<string, string | null | undefined>>();
  readonly ready = output<string>();
  private readonly input = viewChild<ElementRef<HTMLInputElement>>("input");
  private readonly injector = inject(Injector);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly resolved = signal(false);
  protected user!: Awaited<ReturnType<typeof this.initialUser>>;

  ngOnInit(): void {
    this.pendingTasks.run(async () => {
      this.user = await this.initialUser();

      // Destroyed while it waited: the rest of the setup never runs.
      if (this.destroyRef.destroyed) return;

      afterNextRender(
        () => {
          this.input()?.nativeElement.focus();
          this.ready.emit(this.user.name);
        },
        { injector: this.injector },
      );

      this.resolved.set(true);
    });
  }

  private initialUser() {
    return loadUser(this.id());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
