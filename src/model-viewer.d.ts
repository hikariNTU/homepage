import { ModelViewerElement } from "@google/model-viewer";

type ExtraDef = {
  class?: string;
  reveal?: "auto" | "manual";
};

export declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.AllHTMLAttributes<Partial<ModelViewerElement>> & ExtraDef,
        React.AllHTMLAttributes<Partial<ModelViewerElement>> & ExtraDef
      >;
    }
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & ModelViewerAttributes,
        React.AllHTMLAttributes<Partial<ModelViewerElement>> & ExtraDef
      >;
    }
  }
}
