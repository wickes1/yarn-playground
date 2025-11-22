import React, { useEffect } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    MarkerType,
    Position,
    XYPosition
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { ParseResult, YarnNode } from '../types';

// Define nodeTypes and edgeTypes outside component to prevent recreation on each render
const nodeTypes = {};
const edgeTypes = {};

interface VisualizerProps {
    data: ParseResult | null;
    onNodeClick?: (nodeName: string) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 40;

function getNodePosition(node: YarnNode): XYPosition | null {
    const pos = node.Headers?.find(h => h.Key === 'position')?.Value;
    if (!pos) return null;

    const [x, y] = pos.split(',').map(s => parseInt(s.trim(), 10) || 0);
    return { x, y };
}

function layoutWithDagre(nodes: Node[], edges: Edge[]): Node[] {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });

    nodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
    edges.forEach(e => g.setEdge(e.source, e.target));
    dagre.layout(g);

    return nodes.map(node => ({
        ...node,
        targetPosition: Position.Top,
        sourcePosition: Position.Bottom,
        position: {
            x: g.node(node.id).x - NODE_WIDTH / 2,
            y: g.node(node.id).y - NODE_HEIGHT / 2,
        }
    }));
}

export function Visualizer({ data, onNodeClick }: VisualizerProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        if (!data?.Nodes) return;

        // Create nodes
        const newNodes: Node[] = data.Nodes.map(node => {
            const customPos = getNodePosition(node);
            return {
                id: node.Name,
                data: {
                    label: node.Name,
                    hasCustomPosition: !!customPos
                },
                position: customPos || { x: 0, y: 0 },
                style: {
                    background: '#f8f5f0',
                    color: '#4a3f35',
                    border: '1px solid #a67c52',
                    borderRadius: '4px',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    fontFamily: "'Libre Baskerville', serif",
                    cursor: 'pointer',
                    boxShadow: '2px 3px 5px 0px hsl(28 13% 20% / 0.12)',
                    transition: 'all 0.15s ease'
                },
            };
        });

        // Create edges
        const newEdges: Edge[] = [];
        data.Nodes.forEach(node => {
            const dests = new Set<string>();
            node.Instructions.forEach((instr: any) => {
                if (instr.OpCode === 'JumpTo' || instr.OpCode === 'RunNode') {
                    dests.add(instr.Operands[0].Value);
                } else if (instr.OpCode === 'AddOption') {
                    dests.add(instr.Operands[1].Value);
                }
            });

            dests.forEach(dest => {
                newEdges.push({
                    id: `${node.Name}-${dest}`,
                    source: node.Name,
                    target: dest,
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#a67c52' },
                    style: { stroke: '#a67c52', strokeWidth: 1.5 }
                });
            });
        });

        // Apply layout
        const allHaveCustomPos = newNodes.every(n => n.data.hasCustomPosition);
        const hasAnyCustomPos = newNodes.some(n => n.data.hasCustomPosition);

        let finalNodes: Node[];
        if (allHaveCustomPos) {
            finalNodes = newNodes;
        } else if (hasAnyCustomPos) {
            let offset = 0;
            finalNodes = newNodes.map(n => {
                if (n.data.hasCustomPosition) return n;
                const pos = { x: offset * 50, y: offset * 50 };
                offset++;
                return { ...n, position: pos };
            });
        } else {
            finalNodes = layoutWithDagre(newNodes, newEdges);
        }

        setNodes(finalNodes);
        setEdges(newEdges);
    }, [data, setNodes, setEdges]);

    return (
        <div className="h-full w-full bg-surface-2">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => onNodeClick?.(node.id)}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                proOptions={{ hideAttribution: true }}
            >
                <Background color="#d4c4a8" gap={20} size={1} />
                <Controls />
            </ReactFlow>
        </div>
    );
}
