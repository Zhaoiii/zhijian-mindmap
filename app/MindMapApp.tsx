"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, WheelEvent } from "react";
import { cloneMap, validateMindMap, validateRepositoryIndex } from "./lib/mindmap";
import type { MindMapDocument, MindMapNode, NodeSide, RepositoryMapEntry } from "./lib/mindmap";

const LEVEL_X = 260;
const ROW_Y = 108;

const PLACEHOLDER_MAP: MindMapDocument = {
  version: 1,
  id: "loading",
  title: "正在载入脑图…",
  root: {
    id: "root",
    text: "正在载入…",
    side: "center",
    color: "#2D3038",
    collapsed: false,
    children: [],
  },
};

interface PositionedNode {
  node: MindMapNode;
  parentId: string | null;
  x: number;
  y: number;
  depth: number;
  side: NodeSide;
  color: string;
}

interface TransformState {
  x: number;
  y: number;
  scale: number;
}

function visibleLeafCount(node: MindMapNode): number {
  if (node.collapsed || node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + visibleLeafCount(child), 0);
}

function countNodes(node: MindMapNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

function layoutMindMap(root: MindMapNode): PositionedNode[] {
  const result: PositionedNode[] = [
    { node: root, parentId: null, x: 0, y: 0, depth: 0, side: "center", color: root.color },
  ];

  const placeSide = (side: "left" | "right") => {
    const roots = root.collapsed ? [] : root.children.filter((node) => node.side === side);
    const leaves = roots.reduce((sum, node) => sum + visibleLeafCount(node), 0);
    let cursor = -((Math.max(1, leaves) - 1) * ROW_Y) / 2;
    const direction = side === "left" ? -1 : 1;

    const place = (node: MindMapNode, parentId: string, depth: number, branchColor: string): number => {
      let y: number;
      if (node.collapsed || node.children.length === 0) {
        y = cursor;
        cursor += ROW_Y;
      } else {
        const childYs = node.children.map((child) => place(child, node.id, depth + 1, branchColor));
        y = (childYs[0] + childYs[childYs.length - 1]) / 2;
      }
      result.push({ node, parentId, x: direction * depth * LEVEL_X, y, depth, side, color: branchColor });
      return y;
    };

    roots.forEach((node) => place(node, root.id, 1, node.color));
  };

  placeSide("left");
  placeSide("right");
  return result;
}

function findNode(root: MindMapNode, id: string): MindMapNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function mutateTree(node: MindMapNode, operation: (node: MindMapNode) => void) {
  operation(node);
  node.children.forEach((child) => mutateTree(child, operation));
}

function safeFormula(source: string, displayMode: boolean): ReactNode {
  try {
    const html = katex.renderToString(source, {
      displayMode,
      throwOnError: true,
      trust: false,
      strict: "ignore",
      output: "htmlAndMathml",
    });
    return (
      <span
        className={displayMode ? "formula-block" : "formula-inline"}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return <span className="formula-error">{displayMode ? `$$${source}$$` : `$${source}$`}</span>;
  }
}

function RichText({ text }: { text: string }) {
  const tokens = text.split(/(\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\n])+\$)/g);
  return (
    <span className="rich-text">
      {tokens.map((token, index) => {
        if (token.startsWith("$$") && token.endsWith("$$")) {
          return <Fragment key={index}>{safeFormula(token.slice(2, -2), true)}</Fragment>;
        }
        if (token.startsWith("$") && token.endsWith("$")) {
          return <Fragment key={index}>{safeFormula(token.slice(1, -1), false)}</Fragment>;
        }
        return (
          <Fragment key={index}>
            {token.split("\n").map((line, lineIndex) => (
              <Fragment key={lineIndex}>{lineIndex > 0 && <br />}{line}</Fragment>
            ))}
          </Fragment>
        );
      })}
    </span>
  );
}

function outlineLabel(text: string): string {
  return text.replace(/\$+[^$]*\$+/g, "公式").split("\n")[0] || "空主题";
}

function OutlineNode({
  node,
  selectedId,
  onSelect,
  onToggle,
  depth = 0,
}: {
  node: MindMapNode;
  selectedId: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  depth?: number;
}) {
  return (
    <div className="outline-group">
      <div className={`outline-row ${selectedId === node.id ? "active" : ""}`} style={{ paddingLeft: 7 + depth * 14 }}>
        <button
          className="outline-toggle"
          aria-label={node.collapsed ? "展开节点" : "折叠节点"}
          disabled={!node.children.length}
          onClick={() => onToggle(node.id)}
        >
          {node.children.length ? (node.collapsed ? "›" : "⌄") : "·"}
        </button>
        <button className="outline-title" onClick={() => onSelect(node.id)}>{outlineLabel(node.text)}</button>
      </div>
      {!node.collapsed && node.children.map((child) => (
        <OutlineNode
          key={child.id}
          node={child}
          selectedId={selectedId}
          onSelect={onSelect}
          onToggle={onToggle}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function MindMapApp() {
  const [map, setMap] = useState<MindMapDocument>(() => cloneMap(PLACEHOLDER_MAP));
  const [repositoryMaps, setRepositoryMaps] = useState<RepositoryMapEntry[]>([]);
  const [activeRepositoryId, setActiveRepositoryId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("root");
  const [status, setStatus] = useState("正在读取仓库数据…");
  const [toast, setToast] = useState<string | null>(null);
  const [transform, setTransform] = useState<TransformState>({ x: 0, y: 0, scale: 1 });
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const positions = useMemo(() => layoutMindMap(map.root), [map.root]);
  const selectedNode = useMemo(() => findNode(map.root, selectedId) ?? map.root, [map.root, selectedId]);
  const activeEntry = useMemo(
    () => repositoryMaps.find((entry) => entry.id === activeRepositoryId) ?? null,
    [activeRepositoryId, repositoryMaps],
  );
  const totalNodeCount = useMemo(() => countNodes(map.root), [map.root]);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const fitCanvas = useCallback(() => {
    const view = viewRef.current;
    if (!view || !positions.length) return;
    const rect = view.getBoundingClientRect();
    const xs = positions.map((item) => item.x);
    const ys = positions.map((item) => item.y);
    const minX = Math.min(...xs) - 180;
    const maxX = Math.max(...xs) + 180;
    const minY = Math.min(...ys) - 90;
    const maxY = Math.max(...ys) + 90;
    const scale = Math.max(
      0.25,
      Math.min(1.15, (rect.width - 64) / (maxX - minX), (rect.height - 64) / (maxY - minY)),
    );
    setTransform({
      x: rect.width / 2 - ((minX + maxX) / 2) * scale,
      y: rect.height / 2 - ((minY + maxY) / 2) * scale,
      scale,
    });
  }, [positions]);

  const loadRepositoryMap = useCallback(async (entry: RepositoryMapEntry, silent = false) => {
    setStatus(`正在载入「${entry.title}」…`);
    try {
      const response = await fetch(new URL(`mindmaps/${entry.file}`, document.baseURI));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed: unknown = await response.json();
      const checked = validateMindMap(parsed);
      if (!checked.ok) throw new Error(checked.error);
      setMap(cloneMap(checked.data));
      setSelectedId(checked.data.root.id);
      setActiveRepositoryId(entry.id);
      setLeftOpen(false);
      setRightOpen(false);
      setStatus("仓库 JSON · 只读预览");
      if (!silent) notify(`已打开「${entry.title}」`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setStatus("脑图载入失败");
      notify(`仓库脑图载入失败：${message}`);
    }
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        const response = await fetch(new URL("mindmaps/index.json", document.baseURI));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsed: unknown = await response.json();
        if (!validateRepositoryIndex(parsed)) throw new Error("index.json 格式不正确");
        if (cancelled) return;
        setRepositoryMaps(parsed.maps);
        if (!parsed.maps[0]) throw new Error("仓库脑图清单为空");
        await loadRepositoryMap(parsed.maps[0], true);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "未知错误";
        setStatus("仓库清单载入失败");
        notify(`仓库脑图清单载入失败：${message}`);
      }
    };
    void boot();
    return () => { cancelled = true; };
  }, [loadRepositoryMap, notify]);

  useEffect(() => {
    const timer = setTimeout(fitCanvas, 80);
    return () => clearTimeout(timer);
  }, [map.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const updateViewState = useCallback((operation: (draft: MindMapDocument) => void) => {
    setMap((current) => {
      const draft = cloneMap(current);
      operation(draft);
      return draft;
    });
  }, []);

  const toggleNode = useCallback((id: string) => {
    updateViewState((draft) => {
      const node = findNode(draft.root, id);
      if (node?.children.length) node.collapsed = !node.collapsed;
    });
  }, [updateViewState]);

  const setAllCollapsed = useCallback((collapsed: boolean) => {
    updateViewState((draft) => {
      mutateTree(draft.root, (node) => {
        if (node.children.length) node.collapsed = collapsed;
      });
      if (collapsed) draft.root.collapsed = false;
    });
  }, [updateViewState]);

  const selectFromOutline = (id: string) => {
    setSelectedId(id);
    setLeftOpen(false);
    setRightOpen(true);
  };

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".mind-node-card,button")) return;
    dragRef.current = { startX: event.clientX, startY: event.clientY, x: transform.x, y: transform.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setTransform((current) => ({
      ...current,
      x: drag.x + event.clientX - drag.startX,
      y: drag.y + event.clientY - drag.startY,
    }));
  };

  const onCanvasPointerUp = () => { dragRef.current = null; };

  const zoomAtCenter = (factor: number) => {
    const view = viewRef.current;
    if (!view) return;
    const rect = view.getBoundingClientRect();
    setTransform((current) => {
      const next = Math.max(0.25, Math.min(2.2, current.scale * factor));
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      return {
        scale: next,
        x: cx - (cx - current.x) * (next / current.scale),
        y: cy - (cy - current.y) * (next / current.scale),
      };
    });
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    setTransform((current) => {
      const next = Math.max(0.25, Math.min(2.2, current.scale * Math.exp(-event.deltaY * 0.0012)));
      return {
        scale: next,
        x: cx - (cx - current.x) * (next / current.scale),
        y: cy - (cy - current.y) * (next / current.scale),
      };
    });
  };

  const positionById = new Map(positions.map((item) => [item.node.id, item]));
  const sourceUrl = activeEntry ? new URL(`mindmaps/${activeEntry.file}`, document.baseURI).href : null;

  return (
    <main className="mind-app">
      <header className="topbar">
        <button className="mobile-panel-button" aria-label="打开脑图列表" onClick={() => setLeftOpen(true)}>☰</button>
        <div className="brand"><span className="brand-mark">枝</span><b>枝见</b></div>
        <div className="doc-title">
          <strong>{map.title}</strong>
          <span className={status.includes("失败") ? "status-error" : ""}>● {status}</span>
        </div>
        {sourceUrl && <a className="source-link" href={sourceUrl} target="_blank" rel="noreferrer">查看 JSON</a>}
        <button className="mobile-panel-button" aria-label="打开节点详情" onClick={() => setRightOpen(true)}>ⓘ</button>
      </header>

      <section className={`workspace ${leftCollapsed ? "left-collapsed" : ""} ${rightCollapsed ? "right-collapsed" : ""}`}>
        <aside className={`left-panel ${leftOpen ? "mobile-open" : ""}`}>
          <div className="desktop-panel-head"><span>脑图与大纲</span><button aria-label="收起左侧栏" onClick={() => setLeftCollapsed(true)}>‹</button></div>
          <div className="mobile-panel-head"><b>脑图与大纲</b><button aria-label="关闭左侧栏" onClick={() => setLeftOpen(false)}>×</button></div>

          <p className="panel-label">仓库脑图</p>
          <div className="repo-list">
            {repositoryMaps.map((entry) => (
              <button
                key={entry.id}
                className={`map-card ${activeRepositoryId === entry.id ? "active" : ""}`}
                onClick={() => void loadRepositoryMap(entry)}
              >
                <b>{entry.title}</b>
                <small>{entry.description}</small>
              </button>
            ))}
            {!repositoryMaps.length && <p className="empty-hint">正在读取仓库清单…</p>}
          </div>

          <div className="outline-heading">
            <p className="panel-label">大纲</p>
            <span>{positions.length}/{totalNodeCount} 个节点</span>
          </div>
          <div className="outline-tree">
            <OutlineNode
              node={map.root}
              selectedId={selectedNode.id}
              onSelect={selectFromOutline}
              onToggle={toggleNode}
            />
          </div>
          <div className="source-card">
            <b>内容由仓库 JSON 提供</b>
            <span>网页仅负责展示。新增或修改脑图时，请编辑 public/mindmaps/ 并通过校验。</span>
          </div>
        </aside>

        <section className="canvas-shell">
          {leftCollapsed && <button className="panel-reopen-button reopen-left" aria-label="展开左侧栏" onClick={() => setLeftCollapsed(false)}>›</button>}
          {rightCollapsed && <button className="panel-reopen-button reopen-right" aria-label="展开右侧栏" onClick={() => setRightCollapsed(false)}>‹</button>}

          <div className="canvas-top-actions">
            <button onClick={() => setAllCollapsed(false)}>展开全部</button>
            <button onClick={() => setAllCollapsed(true)}>收起分支</button>
          </div>

          <div
            className="mind-canvas"
            ref={viewRef}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerCancel={onCanvasPointerUp}
            onWheel={onWheel}
          >
            <div
              className="canvas-grid"
              style={{
                backgroundPosition: `${transform.x}px ${transform.y}px`,
                backgroundSize: `${22 * transform.scale}px ${22 * transform.scale}px`,
              }}
            />
            <div className="mind-stage" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}>
              <svg className="connector-layer" aria-hidden="true">
                {positions.filter((item) => item.parentId).map((item) => {
                  const parent = positionById.get(item.parentId!);
                  if (!parent) return null;
                  const bend = (item.x - parent.x) * 0.52;
                  return (
                    <path
                      key={item.node.id}
                      d={`M ${parent.x} ${parent.y} C ${parent.x + bend} ${parent.y}, ${item.x - bend} ${item.y}, ${item.x} ${item.y}`}
                      stroke={item.color}
                    />
                  );
                })}
              </svg>
              {positions.map((item) => (
                <div
                  key={item.node.id}
                  className={`node-wrap side-${item.side} ${item.depth === 0 ? "root-wrap" : ""}`}
                  style={{ left: item.x, top: item.y, "--branch-color": item.color } as CSSProperties}
                >
                  <button
                    type="button"
                    className={`mind-node-card ${item.depth === 0 ? "root-node" : ""} ${selectedNode.id === item.node.id ? "selected" : ""}`}
                    onClick={(event) => { event.stopPropagation(); setSelectedId(item.node.id); }}
                    onDoubleClick={() => setRightOpen(true)}
                  >
                    {item.depth === 1 && <span className="branch-dot" />}
                    <RichText text={item.node.text || "空主题"} />
                  </button>
                  {item.node.children.length > 0 && (
                    <button
                      className="collapse-button"
                      aria-label={item.node.collapsed ? "展开节点" : "折叠节点"}
                      onClick={(event) => { event.stopPropagation(); toggleNode(item.node.id); }}
                    >
                      {item.node.collapsed ? `＋${item.node.children.length}` : "−"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="canvas-toolbar">
            <button aria-label="缩小" onClick={() => zoomAtCenter(0.85)}>−</button>
            <span>{Math.round(transform.scale * 100)}%</span>
            <button aria-label="放大" onClick={() => zoomAtCenter(1.18)}>＋</button>
            <button onClick={fitCanvas}>适应画布</button>
          </div>
          <div className="canvas-help">拖动画布 · 滚轮或触控板缩放 · 双击节点查看详情</div>
        </section>

        <aside className={`right-panel ${rightOpen ? "mobile-open" : ""}`}>
          <div className="desktop-panel-head"><span>节点详情</span><button aria-label="收起右侧栏" onClick={() => setRightCollapsed(true)}>›</button></div>
          <div className="mobile-panel-head"><b>节点详情</b><button aria-label="关闭右侧栏" onClick={() => setRightOpen(false)}>×</button></div>

          <div className="detail-heading">
            <div><p className="panel-label">当前节点</p><b>{selectedNode.side === "center" ? "中心主题" : selectedNode.id}</b></div>
            <span className="node-side-badge">{selectedNode.side}</span>
          </div>
          <div className="detail-preview"><RichText text={selectedNode.text || "空主题"} /></div>
          <dl className="node-meta">
            <div><dt>节点 ID</dt><dd>{selectedNode.id}</dd></div>
            <div><dt>方向</dt><dd>{selectedNode.side}</dd></div>
            <div><dt>直接子节点</dt><dd>{selectedNode.children.length}</dd></div>
            <div><dt>分支颜色</dt><dd><i style={{ background: selectedNode.color }} />{selectedNode.color}</dd></div>
          </dl>
          {selectedNode.children.length > 0 && (
            <button className="detail-toggle" onClick={() => toggleNode(selectedNode.id)}>
              {selectedNode.collapsed ? "展开此节点" : "折叠此节点"}
            </button>
          )}
          <div className="security-note"><b>安全展示</b><span>节点文本由 React 转义；LaTeX 以 KaTeX 非信任模式渲染，不执行 HTML 或脚本。</span></div>
        </aside>
      </section>

      {(leftOpen || rightOpen) && (
        <button className="mobile-backdrop" aria-label="关闭面板" onClick={() => { setLeftOpen(false); setRightOpen(false); }} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
