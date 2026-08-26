"use client";

import { useEffect, useRef, useState } from "react";
import type { NetworkGraph } from "@/lib/networks";

interface ForceGraphProps {
  graph: NetworkGraph;
  height?: number;
  onNodeClick?: (nodeId: number, label: string) => void;
}

interface SimNode {
  id: number;
  label: string;
  color: string;
  size: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface SimEdge {
  source: number;
  target: number;
  weight: number;
}

/**
 * Self-contained force-directed graph renderer (SVG, zero deps). Coulomb
 * repulsion between nodes, spring attraction along edges, center gravity,
 * velocity damping.
 */
export function ForceGraph({ graph, height = 400, onNodeClick }: ForceGraphProps) {
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<SimEdge[]>([]);
  const animRef = useRef<number>(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const cx = 300;
    const cy = height / 2;
    nodesRef.current = graph.nodes.map((n) => ({
      ...n,
      x: cx + (Math.random() - 0.5) * 200,
      y: cy + (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
    }));
    edgesRef.current = graph.edges.map((e) => ({ ...e }));

    let frame = 0;
    const maxFrames = 250;
    const REPULSION = 8000;
    const SPRING = 0.04;
    const SPRING_LEN = 120;
    const DAMPING = 0.85;
    const GRAVITY = 0.01;

    const step = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      if (nodes.length === 0) return;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          dist = Math.max(dist, 5);
          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx += fx;
          nodes[i].vy += fy;
          nodes[j].vx -= fx;
          nodes[j].vy -= fy;
        }
      }

      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      for (const e of edges) {
        const s = nodeMap.get(e.source);
        const t = nodeMap.get(e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = SPRING * (dist - SPRING_LEN) * Math.min(e.weight, 5);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      }

      for (const n of nodes) {
        n.vx += (300 - n.x) * GRAVITY;
        n.vy += (height / 2 - n.y) * GRAVITY;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(30, Math.min(570, n.x));
        n.y = Math.max(30, Math.min(height - 30, n.y));
      }

      frame++;
      setTick(frame);
      if (frame < maxFrames) animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, height]);

  const nodes = nodesRef.current;
  const edges = edgesRef.current;

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-600 text-sm" style={{ height }}>
        No network to display. Code statements with actors and concepts to build one.
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 600 ${height}`} className="w-full" style={{ height }}>
      {edges.map((e, i) => {
        const s = nodes.find((n) => n.id === e.source);
        const t = nodes.find((n) => n.id === e.target);
        if (!s || !t) return null;
        return (
          <line
            key={`e${i}`}
            x1={s.x} y1={s.y} x2={t.x} y2={t.y}
            stroke="#475569"
            strokeWidth={Math.min(1 + e.weight, 6)}
            opacity={Math.min(0.2 + e.weight * 0.15, 0.8)}
          />
        );
      })}
      {nodes.map((n) => (
        <g key={n.id} onClick={() => onNodeClick?.(n.id, n.label)} style={{ cursor: onNodeClick ? "pointer" : "default" }}>
          <circle
            cx={n.x} cy={n.y} r={n.size}
            fill={n.color}
            opacity={hovered === null || hovered === n.id ? 0.85 : 0.3}
            stroke={hovered === n.id ? "#fff" : "none"}
            strokeWidth={2}
            onMouseEnter={() => setHovered(n.id)}
            onMouseLeave={() => setHovered(null)}
          />
          <text
            x={n.x} y={n.y + n.size + 14}
            textAnchor="middle"
            fill={hovered === n.id ? "#fff" : "#94a3b8"}
            fontSize={11}
            fontWeight={hovered === n.id ? 600 : 400}
          >
            {n.label.length > 18 ? n.label.slice(0, 16) + "…" : n.label}
          </text>
        </g>
      ))}
      <text x={590} y={height - 5} textAnchor="end" fill="#1e293b" fontSize={8}>{tick}</text>
    </svg>
  );
}
