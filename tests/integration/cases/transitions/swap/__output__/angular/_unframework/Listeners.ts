/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
export type Listeners = {
  [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void;
};

/** A native listener of each event a consumer passes an SVG element, by name (ADR-0118). */
export type SvgListeners = {
  [K in keyof SVGElementEventMap]?: (event: SVGElementEventMap[K]) => void;
};
