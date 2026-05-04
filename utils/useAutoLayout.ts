import { Node, Edge, Position } from "reactflow";
import ELK, { ElkNode } from "elkjs/lib/elk.bundled.js";

const elk = new ELK();

interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
}

export async function getElkLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
) {
  const { nodeWidth = 320, nodeHeight = 120 } = options;

  const elkNodes = nodes.map((node) => ({
    id: node.id,
    width: nodeWidth,
    height: nodeHeight,
    ...(node.data && { labels: [{ text: node.data.title || node.id }] }),
  }));

  const elkEdges = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "mrtree",
      "elk.direction": "DOWN",
      "elk.spacing.nodeNode": "30",
      "elk.layered.mergeEdges": "true",
      "elk.insideSelfLoops.activate": "true",
      "elk.spacing.individual": "30",
      "elk.edgeRouting": "SPLINES",
      "elk.layered.crossingMinimization.strategy": "INTERACTIVE",
      "elk.layered.nodePlacement.strategy": "LINEAR_SEGMENTS",
      "elk.layered.considerModelOrder": "true",
      "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const layout = await elk.layout(elkGraph);

  const layoutedNodes = nodes.map((node) => {
    const elkNode = layout.children?.find((n: ElkNode) => n.id === node.id);
    return {
      ...node,
      position: {
        x: elkNode?.x ?? 0,
        y: elkNode?.y ?? 0,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });

  return { nodes: layoutedNodes, edges };
}
