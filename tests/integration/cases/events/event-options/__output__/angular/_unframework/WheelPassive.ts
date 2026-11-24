import { DestroyRef, Directive, ElementRef, Renderer2, inject, output } from "@angular/core";

@Directive({ selector: "[ufWheelPassive]" })
export class WheelPassive {
  readonly ufWheelPassive = output<WheelEvent>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const stop = inject(Renderer2).listen(
      element,
      "wheel",
      (event: WheelEvent) => this.ufWheelPassive.emit(event),
      { passive: true },
    );
    inject(DestroyRef).onDestroy(stop);
  }
}
