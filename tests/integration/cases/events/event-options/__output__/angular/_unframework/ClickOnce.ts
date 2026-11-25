import { DestroyRef, Directive, ElementRef, Renderer2, inject, output } from "@angular/core";

@Directive({ selector: "[ufClickOnce]" })
export class ClickOnce {
  readonly ufClickOnce = output<PointerEvent>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const stop = inject(Renderer2).listen(
      element,
      "click",
      (event: PointerEvent) => this.ufClickOnce.emit(event),
      { once: true },
    );
    inject(DestroyRef).onDestroy(stop);
  }
}
