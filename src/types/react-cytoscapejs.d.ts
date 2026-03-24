declare module "react-cytoscapejs" {
  import * as React from "react";

  type CytoscapeProps = {
    elements?: unknown;
    style?: React.CSSProperties;
    stylesheet?: unknown;
    layout?: unknown;
    cy?: (cy: unknown) => void;
    minZoom?: number;
    maxZoom?: number;
    wheelSensitivity?: number;
  };

  const CytoscapeComponent: React.ComponentType<CytoscapeProps>;
  export default CytoscapeComponent;
}
