import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { loadUser } from "./api";
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  type OnInit,
  PendingTasks,
  afterNextRender,
  inject,
  input as input_1,
  output,
  signal,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-note",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @if (resolved()) {
      <form
        class="note"
        aria-label="Note"
        [class]="this.class()"
        [style]="this.style()"
        [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
        [ufScope]="this.host"
        #ufElement
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
  readonly ufAttributes = input_1<Record<string, unknown>>();
  readonly ufListeners = input_1<Listeners>();
  readonly ready = output<string>();
  private readonly input = viewChild<ElementRef<HTMLInputElement>>("input");
  readonly ufElement = viewChild<ElementRef<HTMLFormElement>>("ufElement");
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
