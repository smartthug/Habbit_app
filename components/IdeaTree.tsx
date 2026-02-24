"use client";

import { useState } from "react";
import { Lightbulb, Star, ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { format } from "date-fns";

interface IdeaNode {
  _id: string;
  text: string;
  priority: "normal" | "important";
  tags: string[];
  createdAt: string;
  children: IdeaNode[];
}

interface IdeaTreeProps {
  ideas: IdeaNode[];
  onIdeaClick?: (ideaId: string) => void;
}

export default function IdeaTree({ ideas, onIdeaClick }: IdeaTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const expandAll = () => {
    const allNodeIds = new Set<string>();
    const collectIds = (nodes: IdeaNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          allNodeIds.add(node._id);
          collectIds(node.children);
        }
      });
    };
    collectIds(ideas);
    setExpandedNodes(allNodeIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    onIdeaClick?.(nodeId);
  };

  const getNodeStyles = (level: number, hasChildren: boolean, priority: string) => {
    const isParent = level === 0;
    
    if (isParent) {
      // Parent nodes: Blue/Purple gradient
      return {
        borderColor: priority === "important" 
          ? "border-amber-500" 
          : "border-blue-500",
        bgGradient: priority === "important"
          ? "from-amber-400/20 to-orange-400/20 dark:from-amber-400/10 dark:to-orange-400/10"
          : "from-blue-400/20 to-purple-400/20 dark:from-blue-400/10 dark:to-purple-400/10",
        cardBg: "bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30",
        tagBg: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
        levelBadge: "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
      };
    } else {
      // Child nodes: Green/Teal gradient
      return {
        borderColor: priority === "important"
          ? "border-amber-500"
          : "border-emerald-500",
        bgGradient: priority === "important"
          ? "from-amber-400/20 to-orange-400/20 dark:from-amber-400/10 dark:to-orange-400/10"
          : "from-emerald-400/20 to-teal-400/20 dark:from-emerald-400/10 dark:to-teal-400/10",
        cardBg: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30",
        tagBg: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
        levelBadge: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
      };
    }
  };

  const renderNode = (node: IdeaNode, level: number = 0, isLeft?: boolean): JSX.Element => {
    const isExpanded = expandedNodes.has(node._id);
    const hasChildren = node.children && node.children.length > 0;
    const leftChild = node.children?.[0];
    const rightChild = node.children?.[1];
    const indent = level * 60;
    const isParent = level === 0;
    const styles = getNodeStyles(level, hasChildren, node.priority);
    const isSelected = selectedNodeId === node._id;

    return (
      <div key={node._id} className="relative mb-6 min-w-0 max-w-full">
        {/* Node Container */}
        <div className="flex items-start gap-2 sm:gap-3 min-w-0" style={{ marginLeft: `${Math.min(indent, typeof window !== 'undefined' && window.innerWidth < 768 ? 40 : 60)}px` }}>
          {/* Expand/Collapse Button */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node._id);
              }}
              className={`mt-2 p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0 z-10 ${
                isParent ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-8" />}

          {/* Idea Card */}
          <div
            onClick={() => handleNodeClick(node._id)}
            className={`flex-1 group relative overflow-hidden ${styles.cardBg} backdrop-blur-xl rounded-xl p-3 sm:p-4 shadow-lg border-l-4 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer min-w-[240px] sm:min-w-[280px] max-w-full ${
              styles.borderColor
            } ${isSelected ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-blue-400" : ""}`}
          >
            {/* Background gradient effect */}
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${styles.bgGradient} rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500`}></div>
            
            <div className="relative z-10">
              {/* Level badge and header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {/* Level indicator badge */}
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${styles.levelBadge}`}>
                      {isParent ? "Parent" : `Level ${level}`}
                    </span>
                    {node.priority === "important" && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Important</span>
                      </div>
                    )}
                    {hasChildren && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Link2 className="w-3 h-3" />
                        <span>{node.children.length} {node.children.length === 1 ? "child" : "children"}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-900 dark:text-slate-100 font-semibold text-sm leading-relaxed">
                    {node.text}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {node.tags && node.tags.length > 0 && (
                    <>
                      {node.tags.slice(0, 2).map((tag: string, idx: number) => (
                        <span
                          key={idx}
                          className={`text-xs px-2 py-0.5 ${styles.tagBg} rounded-full font-medium`}
                        >
                          {tag}
                        </span>
                      ))}
                      {node.tags.length > 2 && (
                        <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full font-medium">
                          +{node.tags.length - 2}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-2 flex-shrink-0">
                  {format(new Date(node.createdAt), "MMM d")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Lines and Children */}
        {hasChildren && isExpanded && (
          <div className="relative" style={{ marginLeft: `${indent + 40}px` }}>
            {/* Vertical connector line from parent */}
            <div className={`absolute left-0 top-0 w-0.5 h-6 ${
              isParent 
                ? "bg-blue-400 dark:bg-blue-600" 
                : "bg-emerald-400 dark:bg-emerald-600"
            }`} />
            
            {/* Horizontal connector line */}
            <div className={`absolute left-0 top-6 w-full max-w-[320px] h-0.5 ${
              isParent 
                ? "bg-blue-400 dark:bg-blue-600" 
                : "bg-emerald-400 dark:bg-emerald-600"
            }`} />
            
            {/* Children Container */}
            <div className="mt-6 space-y-6">
              {leftChild && (
                <div className="relative">
                  {/* Left child connector */}
                  <div className={`absolute -left-2 top-0 w-2 h-0.5 ${
                    isParent 
                      ? "bg-blue-400 dark:bg-blue-600" 
                      : "bg-emerald-400 dark:bg-emerald-600"
                  }`} />
                  {renderNode(leftChild, level + 1, true)}
                </div>
              )}
              {rightChild && (
                <div className="relative">
                  {/* Right child connector */}
                  <div className={`absolute -left-2 top-0 w-2 h-0.5 ${
                    isParent 
                      ? "bg-blue-400 dark:bg-blue-600" 
                      : "bg-emerald-400 dark:bg-emerald-600"
                  }`} />
                  {renderNode(rightChild, level + 1, false)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (ideas.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
          <Lightbulb className="w-10 h-10 text-amber-500 dark:text-amber-400" />
        </div>
        <p className="text-slate-600 dark:text-slate-400 mb-6 font-medium">
          No ideas yet. Create your first idea to see it in the tree!
        </p>
      </div>
    );
  }

  return (
    <div className="py-4 min-w-0 max-w-full">
      {ideas.length > 0 && (
        <div className="flex gap-2 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors touch-active min-h-[44px]"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors touch-active min-h-[44px]"
          >
            Collapse All
          </button>
        </div>
      )}
      <div className="min-w-0 max-w-full overflow-x-auto overflow-y-visible">
        {ideas.map((idea) => renderNode(idea, 0))}
      </div>
    </div>
  );
}
