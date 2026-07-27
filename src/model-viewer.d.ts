import { ModelViewerElement } from "@google/model-viewer";

type ExtraDef = {
  class?: string;
  reveal?: "auto" | "manual";
};

// The second `DetailedHTMLProps` argument is the element a `ref` points at, not
// another bag of attributes — getting that wrong is what made `ref={...}` on a
// <model-viewer> unassignable.
type ModelViewerProps = React.DetailedHTMLProps<
  React.AllHTMLAttributes<ModelViewerElement> & ExtraDef,
  ModelViewerElement
>;

export declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerProps;
    }
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerProps;
    }
  }
}
