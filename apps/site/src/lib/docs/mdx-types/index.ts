import type { ComponentType, JSX } from "react";

/**
 * Component overrides accepted by compiled MDX modules: keys are intrinsic
 * element names, values are replacement components or element names.
 */
export type MdxComponents = {
  [K in keyof JSX.IntrinsicElements]?:
    | ComponentType<JSX.IntrinsicElements[K]>
    | keyof JSX.IntrinsicElements;
};
