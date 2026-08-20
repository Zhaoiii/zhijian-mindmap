export type NodeSide = "left" | "right" | "center";

export interface MindMapNode {
  id: string;
  text: string;
  side: NodeSide;
  color: string;
  collapsed: boolean;
  children: MindMapNode[];
}

export interface MindMapDocument {
  version: 1;
  id: string;
  title: string;
  root: MindMapNode;
}

export interface RepositoryMapEntry {
  id: string;
  title: string;
  file: string;
  description: string;
}

export interface RepositoryIndex {
  maps: RepositoryMapEntry[];
}

export type ValidationResult =
  | { ok: true; data: MindMapDocument }
  | { ok: false; error: string };

const sides = new Set<NodeSide>(["left", "right", "center"]);
const colorPattern = /^#[0-9a-fA-F]{6}$/;

export function validateMindMap(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "文件顶层必须是 JSON 对象" };
  }
  const value = input as Record<string, unknown>;
  if (value.version !== 1) return { ok: false, error: "仅支持 version: 1 的脑图" };
  if (!isNonEmpty(value.id)) return { ok: false, error: "缺少有效的脑图 id" };
  if (!isNonEmpty(value.title)) return { ok: false, error: "缺少有效的脑图 title" };

  const ids = new Set<string>();
  const nodeError = validateNode(value.root, "root", ids, true);
  if (nodeError) return { ok: false, error: nodeError };
  return { ok: true, data: value as unknown as MindMapDocument };
}

function validateNode(value: unknown, path: string, ids: Set<string>, isRoot = false): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return `${path} 必须是节点对象`;
  const node = value as Record<string, unknown>;
  if (!isNonEmpty(node.id)) return `${path}.id 必须是非空字符串`;
  if (ids.has(node.id as string)) return `节点 id 重复：${node.id as string}`;
  ids.add(node.id as string);
  if (typeof node.text !== "string") return `${path}.text 必须是字符串`;
  if (!sides.has(node.side as NodeSide)) return `${path}.side 必须是 left、right 或 center`;
  if (isRoot && node.side !== "center") return "根节点 side 必须是 center";
  if (!isRoot && node.side === "center") return `${path}.side 不能是 center`;
  if (typeof node.color !== "string" || !colorPattern.test(node.color)) return `${path}.color 必须是 #RRGGBB 颜色`;
  if (typeof node.collapsed !== "boolean") return `${path}.collapsed 必须是布尔值`;
  if (!Array.isArray(node.children)) return `${path}.children 必须是数组`;
  for (let index = 0; index < node.children.length; index += 1) {
    const error = validateNode(node.children[index], `${path}.children[${index}]`, ids);
    if (error) return error;
  }
  return null;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateRepositoryIndex(input: unknown): input is RepositoryIndex {
  if (!input || typeof input !== "object" || !Array.isArray((input as RepositoryIndex).maps)) return false;
  return (input as RepositoryIndex).maps.every((entry) =>
    entry && [entry.id, entry.title, entry.file, entry.description].every((item) => typeof item === "string" && item.length > 0)
  );
}

export function createBlankMap(): MindMapDocument {
  const stamp = Date.now().toString(36);
  return {
    version: 1,
    id: `mindmap-${stamp}`,
    title: "未命名脑图",
    root: {
      id: "root",
      text: "中心主题",
      side: "center",
      color: "#2D3038",
      collapsed: false,
      children: [],
    },
  };
}

export function cloneMap(map: MindMapDocument): MindMapDocument {
  return JSON.parse(JSON.stringify(map)) as MindMapDocument;
}

export function collectIds(root: MindMapNode): Set<string> {
  const ids = new Set<string>();
  const visit = (node: MindMapNode) => {
    ids.add(node.id);
    node.children.forEach(visit);
  };
  visit(root);
  return ids;
}

export function makeNodeId(text: string, ids: Set<string>): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "") || "topic";
  let candidate = base;
  let suffix = 2;
  while (ids.has(candidate)) candidate = `${base}-${suffix++}`;
  return candidate;
}
