declare module 'd3' {
  export * from 'd3-selection';
  export * from 'd3-scale';
  export * from 'd3-array';
  export * from 'd3-axis';
  export * from 'd3-brush';
  export * from 'd3-chord';
  export * from 'd3-color';
  export * from 'd3-contour';
  export * from 'd3-delaunay';
  export * from 'd3-dispatch';
  export * from 'd3-drag';
  export * from 'd3-dsv';
  export * from 'd3-ease';
  export * from 'd3-fetch';
  export * from 'd3-force';
  export * from 'd3-format';
  export * from 'd3-geo';
  export * from 'd3-hierarchy';
  export * from 'd3-interpolate';
  export * from 'd3-path';
  export * from 'd3-polygon';
  export * from 'd3-quadtree';
  export * from 'd3-random';
  export * from 'd3-scale-chromatic';
  export * from 'd3-shape';
  export * from 'd3-time';
  export * from 'd3-time-format';
  export * from 'd3-timer';
  export * from 'd3-transition';
  export * from 'd3-zoom';
}

declare module 'd3-selection' {
  export interface Selection<GElement extends Element, Datum, PElement extends Element, PDatum> {
    select(selector: string): Selection<GElement, Datum, PElement, PDatum>;
    selectAll(selector: string): Selection<GElement, Datum, PElement, PDatum>;
    append(type: string): Selection<GElement, Datum, PElement, PDatum>;
    attr(name: string, value: any): Selection<GElement, Datum, PElement, PDatum>;
    style(name: string, value: any): Selection<GElement, Datum, PElement, PDatum>;
    text(value: any): Selection<GElement, Datum, PElement, PDatum>;
    data<NewDatum>(data: NewDatum[]): Selection<GElement, NewDatum, PElement, PDatum>;
    enter(): Selection<GElement, Datum, PElement, PDatum>;
    remove(): Selection<GElement, Datum, PElement, PDatum>;
  }

  export function select(selector: string | Element): Selection<any, any, any, any>;
  export function selectAll(selector: string): Selection<any, any, any, any>;
}
