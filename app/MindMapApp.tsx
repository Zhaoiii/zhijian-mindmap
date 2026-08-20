"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, WheelEvent } from "react";
import {
  cloneMap,
  collectIds,
  createBlankMap,
  makeNodeId,
  validateMindMap,
  validateRepositoryIndex,
} from "./lib/mindmap";
import type { MindMapDocument, MindMapNode, NodeSide, RepositoryMapEntry } from "./lib/mindmap";

const STORAGE_KEY = "zhijian-mindmap-v1";
const PALETTE = ["#6758E8", "#10A793", "#E58A2D", "#2F80ED", "#D65780", "#7A62C7"];
const LEVEL_X = 246;
const ROW_Y = 102;

interface PositionedNode {
  node: MindMapNode;
  parentId: string | null;
  x: number;
  y: number;
  depth: number;
  side: NodeSide;
  color: string;
}

interface TransformState { x: number; y: number; scale: number }

function visibleLeafCount(node: MindMapNode): number {
  if (node.collapsed || node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + visibleLeafCount(child), 0);
}

function layoutMindMap(root: MindMapNode): PositionedNode[] {
  const result: PositionedNode[] = [{ node: root, parentId: null, x: 0, y: 0, depth: 0, side: "center", color: root.color }];

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

function findParent(root: MindMapNode, id: string): MindMapNode | null {
  if (root.children.some((child) => child.id === id)) return root;
  for (const child of root.children) {
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

function setSubtreeSide(node: MindMapNode, side: "left" | "right", color: string) {
  node.side = side;
  node.color = color;
  node.children.forEach((child) => setSubtreeSide(child, side, color));
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
    return <span className={displayMode ? "formula-block" : "formula-inline"} dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <span className="formula-error">{displayMode ? `$$${source}$$` : `$${source}$`}</span>;
  }
}

function RichText({ text }: { text: string }) {
  const tokens = text.split(/(\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\n])+\$)/g);
  return (
    <span className="rich-text">
      {tokens.map((token, index) => {
        if (token.startsWith("$$") && token.endsWith("$$")) return <Fragment key={index}>{safeFormula(token.slice(2, -2), true)}</Fragment>;
        if (token.startsWith("$") && token.endsWith("$")) return <Fragment key={index}>{safeFormula(token.slice(1, -1), false)}</Fragment>;
        const lines = token.split("\n");
        return <Fragment key={index}>{lines.map((line, lineIndex) => <Fragment key={lineIndex}>{lineIndex > 0 && <br />}{line}</Fragment>)}</Fragment>;
      })}
    </span>
  );
}

function OutlineNode({ node, selectedId, onSelect, depth = 0 }: { node: MindMapNode; selectedId: string; onSelect: (id: string) => void; depth?: number }) {
  return (
    <div className="outline-group">
      <button className={`outline-row ${selectedId === node.id ? "active" : ""}`} style={{ paddingLeft: 8 + depth * 15 }} onClick={() => onSelect(node.id)}>
        <span className="outline-toggle">{node.children.length ? (node.collapsed ? "›" : "⌄") : "·"}</span>
        <span>{node.text.replace(/\$+[^$]*\$+/g, "公式").split("\n")[0] || "空主题"}</span>
      </button>
      {!node.collapsed && node.children.map((child) => <OutlineNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />)}
    </div>
  );
}

export function MindMapApp() {
  const [map, setMap] = useState<MindMapDocument>(() => createBlankMap());
  const [selectedId, setSelectedId] = useState("root");
  const [repositoryMaps, setRepositoryMaps] = useState<RepositoryMapEntry[]>([]);
  const [activeRepositoryId, setActiveRepositoryId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("正在载入…");
  const [toast, setToast] = useState<string | null>(null);
  const [transform, setTransform] = useState<TransformState>({ x: 0, y: 0, scale: 1 });
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positions = useMemo(() => layoutMindMap(map.root), [map.root]);
  const selectedNode = useMemo(() => findNode(map.root, selectedId) ?? map.root, [map.root, selectedId]);
  const selectedParent = useMemo(() => findParent(map.root, selectedNode.id), [map.root, selectedNode.id]);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const fitCanvas = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const rect = view.getBoundingClientRect();
    const xs = positions.map((item) => item.x);
    const ys = positions.map((item) => item.y);
    const minX = Math.min(...xs) - 170;
    const maxX = Math.max(...xs) + 170;
    const minY = Math.min(...ys) - 85;
    const maxY = Math.max(...ys) + 85;
    const scale = Math.max(0.28, Math.min(1.15, (rect.width - 70) / (maxX - minX), (rect.height - 70) / (maxY - minY)));
    setTransform({ x: rect.width / 2 - ((minX + maxX) / 2) * scale, y: rect.height / 2 - ((minY + maxY) / 2) * scale, scale });
  }, [positions]);

  const loadRepositoryMap = useCallback(async (entry: RepositoryMapEntry, silent = false) => {
    try {
      const url = new URL(`mindmaps/${entry.file}`, document.baseURI);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed: unknown = await response.json();
      const checked = validateMindMap(parsed);
      if (!checked.ok) throw new Error(checked.error);
      setMap(cloneMap(checked.data));
      setSelectedId(checked.data.root.id);
      setActiveRepositoryId(entry.id);
      setLeftOpen(false);
      setRightOpen(false);
      if (!silent) notify(`已打开「${entry.title}」`);
    } catch (error) {
      notify(`仓库脑图加载失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      let localLoaded = false;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const checked = validateMindMap(JSON.parse(saved));
          if (checked.ok) {
            setMap(checked.data);
            setSelectedId(checked.data.root.id);
            localLoaded = true;
          }
        }
      } catch {
        notify("本地草稿无法读取，已保留默认内容");
      }
      try {
        const indexUrl = new URL("mindmaps/index.json", document.baseURI);
        const response = await fetch(indexUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const index: unknown = await response.json();
        if (!validateRepositoryIndex(index)) throw new Error("index.json 格式不正确");
        if (!cancelled) {
          setRepositoryMaps(index.maps);
          if (!localLoaded && index.maps[0]) await loadRepositoryMap(index.maps[0], true);
        }
      } catch (error) {
        if (!cancelled) notify(`仓库脑图清单加载失败：${error instanceof Error ? error.message : "未知错误"}`);
      } finally {
        if (!cancelled) {
          setReady(true);
          setSaveStatus("已自动保存");
        }
      }
    };
    void boot();
    return () => { cancelled = true; };
  }, [loadRepositoryMap, notify]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
        setSaveStatus("已自动保存");
      } catch {
        setSaveStatus("保存失败");
        notify("本地保存失败，请导出 JSON 备份当前脑图");
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [map, notify, ready]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(fitCanvas, 60);
    return () => clearTimeout(timer);
  }, [map.id, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const mutate = (operation: (draft: MindMapDocument) => void) => {
    setMap((current) => {
      const draft = cloneMap(current);
      operation(draft);
      return draft;
    });
    setActiveRepositoryId(null);
  };

  const updateSelected = (operation: (node: MindMapNode, draft: MindMapDocument) => void) => {
    mutate((draft) => {
      const node = findNode(draft.root, selectedNode.id);
      if (node) operation(node, draft);
    });
  };

  const addChild = (forcedSide?: "left" | "right") => {
    let nextId = "";
    mutate((draft) => {
      const parent = forcedSide ? draft.root : (findNode(draft.root, selectedNode.id) ?? draft.root);
      const ids = collectIds(draft.root);
      nextId = makeNodeId("新主题", ids);
      let side: "left" | "right";
      let color: string;
      if (parent.side === "center") {
        const leftCount = parent.children.filter((child) => child.side === "left").length;
        const rightCount = parent.children.filter((child) => child.side === "right").length;
        side = forcedSide ?? (rightCount <= leftCount ? "right" : "left");
        color = PALETTE[parent.children.length % PALETTE.length];
      } else {
        side = parent.side;
        color = parent.color;
      }
      parent.collapsed = false;
      parent.children.push({ id: nextId, text: "新主题", side, color, collapsed: false, children: [] });
    });
    setSelectedId(nextId);
    setRightOpen(true);
  };

  const addSibling = () => {
    if (!selectedParent || selectedNode.side === "center") return;
    let nextId = "";
    mutate((draft) => {
      const parent = findNode(draft.root, selectedParent.id);
      if (!parent) return;
      nextId = makeNodeId("新主题", collectIds(draft.root));
      const index = parent.children.findIndex((child) => child.id === selectedNode.id);
      parent.children.splice(index + 1, 0, { id: nextId, text: "新主题", side: selectedNode.side as "left" | "right", color: selectedNode.color, collapsed: false, children: [] });
    });
    setSelectedId(nextId);
    setRightOpen(true);
  };

  const deleteSelected = () => {
    if (!selectedParent || selectedNode.side === "center") return;
    const parentId = selectedParent.id;
    mutate((draft) => {
      const parent = findNode(draft.root, parentId);
      if (parent) parent.children = parent.children.filter((child) => child.id !== selectedNode.id);
    });
    setSelectedId(parentId);
    notify("节点已删除");
  };

  const moveSelectedSide = (side: "left" | "right") => {
    if (selectedNode.side === "center") return;
    const topLevel = map.root.children.find((child) => child.id === selectedNode.id);
    if (!topLevel) return notify("仅一级分支可以切换左右方向");
    updateSelected((node) => setSubtreeSide(node, side, node.color));
  };

  const exportMap = () => {
    const blob = new Blob([`${JSON.stringify(map, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${map.id || "mindmap"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("脑图 JSON 已导出");
  };

  const importMap = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const checked = validateMindMap(parsed);
      if (!checked.ok) throw new Error(checked.error);
      setMap(cloneMap(checked.data));
      setSelectedId(checked.data.root.id);
      setActiveRepositoryId(null);
      notify(`已导入「${checked.data.title}」`);
    } catch (error) {
      notify(`导入失败，当前脑图未改变：${error instanceof Error ? error.message : "文件无法读取"}`);
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".mind-node-card,button")) return;
    dragRef.current = { startX: event.clientX, startY: event.clientY, x: transform.x, y: transform.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setTransform((current) => ({ ...current, x: drag.x + event.clientX - drag.startX, y: drag.y + event.clientY - drag.startY }));
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
      return { scale: next, x: cx - (cx - current.x) * (next / current.scale), y: cy - (cy - current.y) * (next / current.scale) };
    });
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    setTransform((current) => {
      const next = Math.max(0.25, Math.min(2.2, current.scale * Math.exp(-event.deltaY * 0.0012)));
      return { scale: next, x: cx - (cx - current.x) * (next / current.scale), y: cy - (cy - current.y) * (next / current.scale) };
    });
  };

  // The handler intentionally tracks the latest selected node and editing operations.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onKeyDown = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.matches("textarea,input")) return;
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelected(); }
    if (event.key === "Enter") { event.preventDefault(); addChild(); }
    if (event.key === "Tab") { event.preventDefault(); addSibling(); }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKeyDown(event as unknown as React.KeyboardEvent);
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onKeyDown]);

  const positionById = new Map(positions.map((item) => [item.node.id, item]));

  return (
    <main className="mind-app">
      <header className="topbar">
        <button className="mobile-panel-button" aria-label="打开脑图列表" onClick={() => setLeftOpen(true)}>☰</button>
        <div className="brand"><span className="brand-mark">枝</span><b>枝见</b></div>
        <div className="doc-title">
          <input aria-label="脑图标题" value={map.title} onChange={(event) => mutate((draft) => { draft.title = event.target.value; })} />
          <span className={saveStatus === "保存失败" ? "save-error" : ""}>● {saveStatus}</span>
        </div>
        <nav className="top-actions" aria-label="文件操作">
          <button className="primary-action" onClick={() => { const fresh = createBlankMap(); setMap(fresh); setSelectedId(fresh.root.id); setActiveRepositoryId(null); }}>＋ 新建</button>
          <button onClick={() => importRef.current?.click()}>导入</button>
          <button onClick={exportMap}>导出</button>
          <input ref={importRef} className="hidden-input" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importMap(file); }} />
        </nav>
        <button className="mobile-panel-button" aria-label="打开节点编辑" onClick={() => setRightOpen(true)}>✎</button>
      </header>

      <section className="workspace">
        <aside className={`left-panel ${leftOpen ? "mobile-open" : ""}`}>
          <div className="mobile-panel-head"><b>脑图与大纲</b><button onClick={() => setLeftOpen(false)}>×</button></div>
          <p className="panel-label">仓库脑图</p>
          <div className="repo-list">
            {repositoryMaps.map((entry) => (
              <button key={entry.id} className={`map-card ${activeRepositoryId === entry.id ? "active" : ""}`} onClick={() => void loadRepositoryMap(entry)}>
                <b>{entry.title}</b><small>{entry.description}</small>
              </button>
            ))}
            {!repositoryMaps.length && <p className="empty-hint">正在读取仓库清单…</p>}
          </div>
          <div className="outline-heading"><p className="panel-label">大纲</p><span>{positions.length} 个可见节点</span></div>
          <div className="outline-tree"><OutlineNode node={map.root} selectedId={selectedNode.id} onSelect={(id) => { setSelectedId(id); setRightOpen(true); }} /></div>
          <div className="shortcut-card"><b>快捷键</b><span>Enter 子主题 · Tab 同级 · Delete 删除</span></div>
        </aside>

        <section className="canvas-shell">
          <div className="canvas-top-actions">
            <button onClick={() => addChild("left")}>＋ 左分支</button>
            <button onClick={() => addChild("right")}>＋ 右分支</button>
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
            <div className="canvas-grid" style={{ backgroundPosition: `${transform.x}px ${transform.y}px`, backgroundSize: `${22 * transform.scale}px ${22 * transform.scale}px` }} />
            <div className="mind-stage" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}>
              <svg className="connector-layer" aria-hidden="true">
                {positions.filter((item) => item.parentId).map((item) => {
                  const parent = positionById.get(item.parentId!);
                  if (!parent) return null;
                  const direction = item.side === "left" ? -1 : 1;
                  const startX = parent.x + direction * (parent.depth === 0 ? 65 : 86);
                  const endX = item.x - direction * 86;
                  const bend = (endX - startX) * 0.52;
                  return <path key={item.node.id} d={`M ${startX} ${parent.y} C ${startX + bend} ${parent.y}, ${endX - bend} ${item.y}, ${endX} ${item.y}`} stroke={item.color} />;
                })}
              </svg>
              {positions.map((item) => (
                <div key={item.node.id} className={`node-wrap ${item.depth === 0 ? "root-wrap" : ""}`} style={{ left: item.x, top: item.y, "--branch-color": item.color } as CSSProperties}>
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
                    <button className="collapse-button" aria-label={item.node.collapsed ? "展开节点" : "折叠节点"} onClick={(event) => { event.stopPropagation(); mutate((draft) => { const target = findNode(draft.root, item.node.id); if (target) target.collapsed = !target.collapsed; }); }}>
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
          <div className="canvas-help">拖动画布 · 滚轮缩放 · 双击节点编辑</div>
        </section>

        <aside className={`right-panel ${rightOpen ? "mobile-open" : ""}`}>
          <div className="mobile-panel-head"><b>节点编辑</b><button onClick={() => setRightOpen(false)}>×</button></div>
          <div className="editor-heading"><div><p className="panel-label">节点编辑</p><b>{selectedNode.side === "center" ? "中心主题" : selectedNode.id}</b></div><span className="node-side-badge">{selectedNode.side}</span></div>
          <label htmlFor="node-text">文字与 LaTeX</label>
          <textarea id="node-text" value={selectedNode.text} spellCheck={false} onChange={(event) => updateSelected((node) => { node.text = event.target.value; })} placeholder={'普通文字与 $行内公式$\n或 $$独立公式$$'} />
          <p className="field-help">使用 <code>$...$</code> 行内公式，<code>$$...$$</code> 独立公式</p>
          <p className="preview-label">实时预览</p>
          <div className="edit-preview"><RichText text={selectedNode.text || "空主题"} /></div>

          {selectedNode.side !== "center" && map.root.children.some((child) => child.id === selectedNode.id) && (
            <div className="field-group">
              <span>分支方向</span>
              <div className="segmented"><button className={selectedNode.side === "left" ? "active" : ""} onClick={() => moveSelectedSide("left")}>向左</button><button className={selectedNode.side === "right" ? "active" : ""} onClick={() => moveSelectedSide("right")}>向右</button></div>
            </div>
          )}
          {selectedNode.side !== "center" && map.root.children.some((child) => child.id === selectedNode.id) && (
            <div className="field-group"><span>分支颜色</span><input className="color-input" type="color" value={selectedNode.color} onChange={(event) => updateSelected((node) => setSubtreeSide(node, node.side as "left" | "right", event.target.value))} /></div>
          )}

          <div className="edit-actions">
            <button className="accent" onClick={() => addChild()}>＋ 子主题</button>
            <button disabled={!selectedParent} onClick={addSibling}>＋ 同级主题</button>
            <button onClick={() => updateSelected((node) => { node.collapsed = !node.collapsed; })} disabled={!selectedNode.children.length}>{selectedNode.collapsed ? "展开" : "折叠"}</button>
            <button className="danger" disabled={!selectedParent} onClick={deleteSelected}>删除节点</button>
          </div>
          <div className="security-note"><b>安全渲染</b><span>公式以非信任模式渲染，节点中的 HTML 与脚本不会执行。</span></div>
        </aside>
      </section>
      {(leftOpen || rightOpen) && <button className="mobile-backdrop" aria-label="关闭面板" onClick={() => { setLeftOpen(false); setRightOpen(false); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
