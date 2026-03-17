"use client";

import { useState, useEffect, useRef } from "react";
import { Lightbulb, Star } from "lucide-react";

interface IdeaNode {
  _id: string;
  text: string;
  description?: string;
  priority: "normal" | "important";
  tags: string[];
  createdAt: string;
  parentId?: string;
  children?: IdeaNode[];
}

interface IdeaGraphProps {
  ideas: IdeaNode[];
  onIdeaClick?: (ideaId: string) => void;
}

interface GraphNode {
  id: string;
  text: string;
  priority: string;
  x: number;
  y: number;
  radius: number;
}

interface GraphLink {
  source: string;
  target: string;
}

export default function IdeaGraph({ ideas, onIdeaClick }: IdeaGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; distance: number } | null>(null);
  const [lastTouch, setLastTouch] = useState<{ x: number; y: number } | null>(null);
  const [touchMoved, setTouchMoved] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState(0);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== "undefined") {
        setIsMobile(window.innerWidth < 768);
      }
    };
    checkMobile();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
    }
    return;
  }, []);

  // Recalculate layout on window resize
  useEffect(() => {
    if (nodes.length === 0) return;
    
    const handleResize = () => {
      if (typeof window === "undefined") return;
      // Trigger recalculation by updating nodes with new sizes
      setNodes((prev) =>
        prev.map((node) => {
          const idea = ideas.find((i) => i._id === node.id);
          if (!idea) return node;
          const isMobileView = window.innerWidth < 768;
          return {
            ...node,
            radius: isMobileView
              ? idea.priority === "important"
                ? 45
                : 35
              : idea.priority === "important"
              ? 60
              : 50,
          };
        })
      );
    };

    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
    return;
  }, [nodes.length, ideas]);

  // Build graph structure from ideas with BINARY TREE layout
  useEffect(() => {
    if (ideas.length === 0) return;

    const nodeMap = new Map<string, GraphNode>();
    const linkList: GraphLink[] = [];
    const allNodes: IdeaNode[] = [];

    // Flatten tree structure to get all nodes
    const flattenNodes = (node: IdeaNode) => {
      allNodes.push(node);
      if (node.children) {
        node.children.forEach(child => flattenNodes(child));
      }
    };

    ideas.forEach(root => flattenNodes(root));

    // Create graph nodes with responsive sizing
    const isMobileView = typeof window !== "undefined" && window.innerWidth < 768;
    
    allNodes.forEach((idea) => {
      nodeMap.set(idea._id, {
        id: idea._id,
        text: idea.text || idea.description || "",
        priority: idea.priority,
        x: 0,
        y: 0,
        radius: isMobileView 
          ? (idea.priority === "important" ? 45 : 35)
          : (idea.priority === "important" ? 60 : 50),
      });
    });

    // Create links based on parent-child relationships
    allNodes.forEach(idea => {
      if (idea.parentId) {
        linkList.push({
          source: idea.parentId,
          target: idea._id,
        });
      }
    });

    // BINARY TREE LAYOUT ALGORITHM
    const HORIZONTAL_SPACING = isMobileView ? 120 : 180;
    const VERTICAL_SPACING = isMobileView ? 120 : 150;
    const START_X = isMobileView ? 200 : 400;
    const START_Y = isMobileView ? 100 : 80;

    // Build children map
    const childrenMap = new Map<string, IdeaNode[]>();
    allNodes.forEach(idea => {
      if (idea.parentId) {
        const parentId = idea.parentId.toString();
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)!.push(idea);
      }
    });

    // Calculate tree width for each node (for centering)
    const calculateTreeWidth = (nodeId: string): number => {
      const children = childrenMap.get(nodeId) || [];
      if (children.length === 0) return HORIZONTAL_SPACING;
      
      let totalWidth = 0;
      children.forEach(child => {
        totalWidth += calculateTreeWidth(child._id);
      });
      return Math.max(totalWidth, HORIZONTAL_SPACING);
    };

    // Position nodes in binary tree layout
    const positionNode = (nodeId: string, x: number, y: number, level: number) => {
      const node = nodeMap.get(nodeId);
      if (!node) return x;

      node.x = x;
      node.y = y;

      const children = childrenMap.get(nodeId) || [];
      if (children.length === 0) {
        return x;
      }

      // Binary tree: max 2 children
      const leftChild = children[0];
      const rightChild = children[1];

      let currentX = x;
      
      if (leftChild) {
        const leftTreeWidth = calculateTreeWidth(leftChild._id);
        const leftX = currentX - leftTreeWidth / 2;
        positionNode(leftChild._id, leftX, y + VERTICAL_SPACING, level + 1);
        currentX = leftX + leftTreeWidth / 2;
      }

      if (rightChild) {
        const rightTreeWidth = calculateTreeWidth(rightChild._id);
        const rightX = currentX + HORIZONTAL_SPACING;
        positionNode(rightChild._id, rightX, y + VERTICAL_SPACING, level + 1);
      }

      return x;
    };

    // Find root nodes (nodes without parents)
    const rootNodes = allNodes.filter(idea => !idea.parentId);
    
    // Position root nodes
    if (rootNodes.length === 1) {
      // Single root - place at top center
      const root = nodeMap.get(rootNodes[0]._id);
      if (root) {
        const treeWidth = calculateTreeWidth(rootNodes[0]._id);
        positionNode(rootNodes[0]._id, START_X, START_Y, 0);
      }
    } else if (rootNodes.length > 1) {
      // Multiple roots - arrange horizontally
      let currentX = START_X;
      rootNodes.forEach((rootNode) => {
        const root = nodeMap.get(rootNode._id);
        if (root) {
          const treeWidth = calculateTreeWidth(rootNode._id);
          positionNode(rootNode._id, currentX, START_Y, 0);
          currentX += treeWidth + HORIZONTAL_SPACING;
        }
      });
    }

    // Position any remaining unpositioned nodes
    Array.from(nodeMap.values()).forEach(node => {
      if (node.x === 0 && node.y === 0) {
        // Find a position to the right
        const maxX = Math.max(...Array.from(nodeMap.values()).map(n => n.x), START_X);
        node.x = maxX + HORIZONTAL_SPACING;
        node.y = START_Y;
      }
    });

    setNodes(Array.from(nodeMap.values()));
    setLinks(linkList);
  }, [ideas]);

  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    onIdeaClick?.(nodeId);
  };

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !draggedNode) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && !draggedNode) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else if (draggedNode) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;
        setNodes(prev => prev.map(node =>
          node.id === draggedNode ? { ...node, x, y } : node
        ));
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedNode(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.3, Math.min(2, prev * delta)));
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggedNode(nodeId);
    setIsDragging(false);
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        setDragStart({
          x: e.clientX - node.x * zoom - pan.x,
          y: e.clientY - node.y * zoom - pan.y,
        });
      }
    }
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setTouchStart({ x: touch.clientX, y: touch.clientY, distance: 0 });
      setLastTouch({ x: touch.clientX, y: touch.clientY });
      setTouchMoved(false);
      setTouchStartTime(Date.now());
      if (!draggedNode) {
        setIsDragging(true);
        setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
      }
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      setTouchStart({ x: (touch1.clientX + touch2.clientX) / 2, y: (touch1.clientY + touch2.clientY) / 2, distance });
      setDraggedNode(null);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStart && !draggedNode) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStart.x);
      const deltaY = Math.abs(touch.clientY - touchStart.y);
      
      if (deltaX > 5 || deltaY > 5) {
        e.preventDefault();
        setTouchMoved(true);
        setPan({
          x: touch.clientX - dragStart.x,
          y: touch.clientY - dragStart.y,
        });
        setLastTouch({ x: touch.clientX, y: touch.clientY });
      }
    } else if (e.touches.length === 2 && touchStart) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      if (touchStart.distance > 0) {
        const scale = distance / touchStart.distance;
        setZoom(prev => {
          const newZoom = prev * scale;
          return Math.max(0.3, Math.min(2, newZoom));
        });
        setTouchStart({ ...touchStart, distance });
      } else {
        setTouchStart({ ...touchStart, distance });
      }
      setTouchMoved(true);
    } else if (draggedNode && e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (touch.clientX - rect.left - pan.x) / zoom;
        const y = (touch.clientY - rect.top - pan.y) / zoom;
        setNodes(prev => prev.map(node =>
          node.id === draggedNode ? { ...node, x, y } : node
        ));
        setTouchMoved(true);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchMoved && touchStart && !draggedNode && Date.now() - touchStartTime < 300) {
      const touch = e.changedTouches[0];
      if (touch && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const x = (touch.clientX - rect.left - pan.x) / zoom;
        const y = (touch.clientY - rect.top - pan.y) / zoom;
        
        const clickedNode = nodes.find(node => {
          const distance = Math.hypot(node.x - x, node.y - y);
          return distance <= node.radius;
        });
        
        if (clickedNode) {
          handleNodeClick(clickedNode.id);
        }
      }
    }
    
    setIsDragging(false);
    setDraggedNode(null);
    setTouchStart(null);
    setLastTouch(null);
    setTouchMoved(false);
    setTouchStartTime(0);
  };

  const handleNodeTouchStart = (e: React.TouchEvent, nodeId: string) => {
    e.stopPropagation();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setDraggedNode(nodeId);
      setTouchMoved(false);
      setTouchStartTime(Date.now());
      setIsDragging(false);
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setDragStart({
            x: touch.clientX - node.x * zoom - pan.x,
            y: touch.clientY - node.y * zoom - pan.y,
          });
        }
      }
    }
  };

  if (ideas.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
          <Lightbulb className="w-10 h-10 text-amber-500 dark:text-amber-400" />
        </div>
        <p className="text-slate-600 dark:text-slate-400 mb-6 font-medium">
          No ideas yet. Create your first idea to see it in the graph!
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] sm:h-[500px] md:h-[600px] lg:h-[700px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden" style={{ touchAction: 'none' }}>
      <div
        ref={containerRef}
        className="w-full h-full cursor-move select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="absolute inset-0"
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Draw links - Theme-aware colors */}
            {links.map((link, index) => {
              const sourceNode = nodes.find(n => n.id === link.source);
              const targetNode = nodes.find(n => n.id === link.target);
              if (!sourceNode || !targetNode) return null;

              return (
                <line
                  key={`link-${index}`}
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke="rgb(148, 163, 184)"
                  strokeWidth="2"
                  className="dark:stroke-slate-400"
                  opacity="0.6"
                />
              );
            })}

            {/* Draw nodes */}
            {nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isImportant = node.priority === "important";

              return (
                <g key={node.id}>
                  {/* Node circle - Theme-aware colors */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.radius}
                    fill={isImportant 
                      ? "rgb(251, 191, 36)" 
                      : "rgb(99, 102, 241)"}
                    className={`dark:${isImportant ? "fill-amber-500" : "fill-indigo-500"} cursor-move transition-all touch-none ${
                      isSelected ? "ring-4 ring-blue-500 dark:ring-blue-400" : ""
                    }`}
                    onClick={() => handleNodeClick(node.id)}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onTouchStart={(e) => handleNodeTouchStart(e, node.id)}
                    opacity="0.95"
                    style={{ filter: isSelected ? "brightness(1.1)" : "none" }}
                  />
                  
                  {/* Node text - Theme-aware colors */}
                  {node.text.length <= (isMobile ? 10 : 15) ? (
                    <text
                      x={node.x}
                      y={node.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      className="text-sm font-semibold pointer-events-none select-none"
                      style={{ 
                        fontSize: isMobile ? "10px" : "13px", 
                        fontWeight: "600",
                        textShadow: "0 1px 2px rgba(0,0,0,0.3)"
                      }}
                    >
                      {node.text}
                    </text>
                  ) : (
                    <foreignObject
                      x={node.x - node.radius}
                      y={node.y - node.radius}
                      width={node.radius * 2}
                      height={node.radius * 2}
                      className="pointer-events-none"
                    >
                      <div className="w-full h-full flex items-center justify-center text-center px-1 sm:px-2">
                        <p className={`text-white font-semibold leading-tight break-words ${
                          isMobile ? "text-[9px]" : "text-xs"
                        }`} style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
                          {node.text}
                        </p>
                      </div>
                    </foreignObject>
                  )}

                  {/* Priority indicator */}
                  {isImportant && (
                    <foreignObject
                      x={node.x + node.radius - (isMobile ? 16 : 20)}
                      y={node.y - node.radius + (isMobile ? 3 : 5)}
                      width={isMobile ? "16" : "20"}
                      height={isMobile ? "16" : "20"}
                      className="pointer-events-none"
                    >
                      <Star className={`${isMobile ? "w-4 h-4" : "w-5 h-5"} text-amber-600 fill-amber-500 dark:text-amber-400 dark:fill-amber-500`} />
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Controls - Mobile friendly */}
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex flex-col gap-1.5 sm:gap-2 z-10">
        <button
          onClick={() => setZoom(prev => Math.min(2, prev * 1.2))}
          className="px-3 py-2 sm:px-3 sm:py-2 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm text-slate-700 dark:text-slate-300 rounded-lg text-base sm:text-sm font-bold sm:font-semibold hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-95 transition-all shadow-md touch-manipulation min-h-[44px] min-w-[44px] border border-slate-200 dark:border-slate-600"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(0.3, prev * 0.8))}
          className="px-3 py-2 sm:px-3 sm:py-2 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm text-slate-700 dark:text-slate-300 rounded-lg text-base sm:text-sm font-bold sm:font-semibold hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-95 transition-all shadow-md touch-manipulation min-h-[44px] min-w-[44px] border border-slate-200 dark:border-slate-600"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => {
            setPan({ x: 0, y: 0 });
            setZoom(1);
          }}
          className="px-2.5 py-2 sm:px-3 sm:py-2 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm text-slate-700 dark:text-slate-300 rounded-lg text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-95 transition-all shadow-md touch-manipulation min-h-[44px] border border-slate-200 dark:border-slate-600"
          aria-label="Reset view"
        >
          <span className="hidden sm:inline">Reset</span>
          <span className="sm:hidden">↺</span>
        </button>
      </div>

      {/* Instructions - Hidden on mobile */}
      <div className="hidden sm:block absolute bottom-4 left-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        Drag to pan • Scroll to zoom • Drag nodes to reposition
      </div>
      
      {/* Mobile instructions */}
      <div className="sm:hidden absolute bottom-2 left-2 right-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-2 py-1.5 rounded-lg text-[10px] text-slate-700 dark:text-slate-300 text-center border border-slate-200 dark:border-slate-700">
        Pinch to zoom • Drag to pan • Tap nodes to select • Drag nodes to move
      </div>
    </div>
  );
}
