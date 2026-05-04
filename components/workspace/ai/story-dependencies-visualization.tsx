import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  ReactFlowInstance,
  Handle,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import { UserStory } from "@/types";
import { Badge } from "@/components/ui/badge";
import { getPriorityColor } from "@/lib/utils";
import { getElkLayoutedElements } from "@/utils/useAutoLayout";
import {
  Minus,
  Network,
  Plus,
  SquareCheckBig,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface StoryDependenciesVisualizationProps {
  stories: UserStory[];
  onClose: () => void;
}

const nodeWidth = 320;
const nodeHeight = 120;

const StoryNode = ({ data }: { data: UserStory }) => {
  return (
    <div className="p-4 bg-card border rounded-lg shadow-sm w-[320px]">
      <Handle
        type="target"
        position={Position.Top}
        style={{ visibility: "hidden" }}
      />
      <div className="flex items-center gap-2 mb-2">
        <SquareCheckBig className="w-4 h-4" />
        <h3 className="font-semibold text-sm">{data.title}</h3>
      </div>
      <div className="flex items-center space-x-2">
        <Badge className={getPriorityColor(data.priority)}>
          {data.priority}
        </Badge>
        <Badge variant="outline">{data.storyPoints} pts</Badge>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ visibility: "hidden" }}
      />
    </div>
  );
};

const BacklogNode = () => {
  return (
    <div className="p-4 bg-primary/10 border border-primary rounded-lg shadow-sm w-[320px]">
      <Handle
        type="target"
        position={Position.Top}
        style={{ visibility: "hidden" }}
      />
      <h3 className="font-semibold text-sm text-primary">BACKLOG</h3>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ visibility: "hidden" }}
      />
    </div>
  );
};

const nodeTypes = {
  story: StoryNode,
  backlog: BacklogNode,
};

function StoryDependenciesVisualizationInner({
  stories,
  onClose: _onClose,
}: StoryDependenciesVisualizationProps) {
  const { zoomIn, zoomOut } = useReactFlow();

  const proOptions = { hideAttribution: true };
  const baseNodes: Node[] = useMemo(
    () => [
      {
        id: "backlog",
        type: "backlog",
        data: {},
        position: { x: 0, y: 0 },
      },
      ...stories.map((story) => ({
        id: story.id,
        type: "story",
        data: story,
        position: { x: 0, y: 0 },
      })),
    ],
    [stories]
  );

  const baseEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    stories.forEach((story) => {
      if (story.parentTaskId) {
        edges.push({
          id: `${story.parentTaskId}-${story.id}`,
          source: story.parentTaskId,
          target: story.id,
          type: "smoothstep",
          animated: true,
        });
      } else {
        edges.push({
          id: `backlog-${story.id}`,
          source: "backlog",
          target: story.id,
          type: "smoothstep",
          animated: true,
        });
      }
    });
    return edges;
  }, [stories]);

  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes);
  const [edges, _setEdges, onEdgesChange] = useEdgesState(baseEdges);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  // Initial layout with ELK on mount and when stories change
  useEffect(() => {
    getElkLayoutedElements(baseNodes, baseEdges, {
      nodeWidth,
      nodeHeight,
    }).then(({ nodes: layoutedNodes }) => {
      setNodes(layoutedNodes);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseNodes, baseEdges]);

  // Auto-layout handler
  const handleAutoLayout = useCallback(async () => {
    const { nodes: layoutedNodes } = await getElkLayoutedElements(
      nodes,
      edges,
      { nodeWidth, nodeHeight }
    );
    setNodes(layoutedNodes);
    if (reactFlowInstance) {
      reactFlowInstance.fitView();
    }
  }, [nodes, edges, setNodes, reactFlowInstance]);

  return (
    <div className="h-[600px] w-5xl">
      <TooltipProvider>
        <div className="absolute bottom-0 left-1 mb-2 flex flex-col gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1 text-secondary-text border rounded hover:workspace-hover transition flex items-center gap-2"
                onClick={() => zoomIn()}
              >
                <Plus className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Zoom in</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1 text-secondary-text border rounded hover:workspace-hover transition flex items-center gap-2"
                onClick={() => zoomOut()}
              >
                <Minus className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Zoom out</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1 text-secondary-text border rounded hover:workspace-hover transition flex items-center gap-2"
                onClick={handleAutoLayout}
              >
                <Network className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Auto layout</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onInit={setReactFlowInstance}
          proOptions={proOptions}
        >
          <Background />
          <MiniMap />
        </ReactFlow>
      </TooltipProvider>
    </div>
  );
}

export default function StoryDependenciesVisualization(
  props: StoryDependenciesVisualizationProps
) {
  return (
    <ReactFlowProvider>
      <StoryDependenciesVisualizationInner {...props} />
    </ReactFlowProvider>
  );
}
