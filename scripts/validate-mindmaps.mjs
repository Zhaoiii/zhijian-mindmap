import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import katex from "katex";

const root = process.cwd();
const mapsDir = path.join(root, "public", "mindmaps");
const indexFile = path.join(mapsDir, "index.json");
const errors = [];
const checkedFiles = [];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${path.relative(root, file)}: JSON 无法解析（${error.message}）`);
    return null;
  }
}

function checkFormula(text, location) {
  const pattern = /(\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\n])+\$)/g;
  for (const match of text.matchAll(pattern)) {
    const display = match[0].startsWith("$$");
    const source = match[0].slice(display ? 2 : 1, display ? -2 : -1);
    try {
      katex.renderToString(source, { throwOnError: true, trust: false, strict: "ignore", displayMode: display });
    } catch (error) {
      errors.push(`${location}: LaTeX 无法渲染（${error.message}）`);
    }
  }
}

function checkNode(node, location, ids, rootNode, inheritedSide) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    errors.push(`${location}: 节点必须是对象`);
    return;
  }
  const required = ["id", "text", "side", "color", "collapsed", "children"];
  for (const field of required) if (!(field in node)) errors.push(`${location}: 缺少字段 ${field}`);
  if (typeof node.id !== "string" || !node.id.trim()) errors.push(`${location}.id: 必须是非空字符串`);
  else if (ids.has(node.id)) errors.push(`${location}.id: 重复的节点 ID「${node.id}」`);
  else ids.add(node.id);
  if (typeof node.text !== "string") errors.push(`${location}.text: 必须是字符串`);
  else checkFormula(node.text, `${location}.text`);
  if (!["left", "right", "center"].includes(node.side)) errors.push(`${location}.side: 仅可为 left、right 或 center`);
  if (rootNode && node.side !== "center") errors.push(`${location}.side: 根节点必须为 center`);
  if (!rootNode && node.side === "center") errors.push(`${location}.side: 非根节点不能为 center`);
  if (inheritedSide && node.side !== inheritedSide) errors.push(`${location}.side: 应继承一级分支方向 ${inheritedSide}`);
  if (typeof node.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(node.color)) errors.push(`${location}.color: 必须是 #RRGGBB`);
  if (typeof node.collapsed !== "boolean") errors.push(`${location}.collapsed: 必须是布尔值`);
  if (!Array.isArray(node.children)) {
    errors.push(`${location}.children: 必须是数组`);
    return;
  }
  node.children.forEach((child, index) => {
    const branchSide = rootNode ? child?.side : inheritedSide;
    checkNode(child, `${location}.children[${index}]`, ids, false, branchSide);
  });
}

const index = readJson(indexFile);
if (index) {
  if (!Array.isArray(index.maps)) {
    errors.push("public/mindmaps/index.json: maps 必须是数组");
  } else {
    const mapIds = new Set();
    for (const [indexNumber, entry] of index.maps.entries()) {
      const location = `public/mindmaps/index.json maps[${indexNumber}]`;
      if (!entry || typeof entry !== "object") {
        errors.push(`${location}: 条目必须是对象`);
        continue;
      }
      for (const field of ["id", "title", "file", "description"]) {
        if (typeof entry[field] !== "string" || !entry[field].trim()) errors.push(`${location}.${field}: 必须是非空字符串`);
      }
      if (mapIds.has(entry.id)) errors.push(`${location}.id: 重复的脑图 ID「${entry.id}」`);
      mapIds.add(entry.id);
      if (typeof entry.file !== "string" || path.basename(entry.file) !== entry.file || !entry.file.endsWith(".json")) {
        errors.push(`${location}.file: 仅允许当前目录中的 .json 文件名`);
        continue;
      }
      const file = path.join(mapsDir, entry.file);
      if (!fs.existsSync(file)) {
        errors.push(`${location}.file: 文件不存在（${entry.file}）`);
        continue;
      }
      const map = readJson(file);
      if (!map) continue;
      checkedFiles.push(entry.file);
      if (map.version !== 1) errors.push(`${entry.file}.version: 必须为 1`);
      if (typeof map.id !== "string" || !map.id.trim()) errors.push(`${entry.file}.id: 必须是非空字符串`);
      if (map.id !== entry.id) errors.push(`${entry.file}.id: 必须与 index.json 中的「${entry.id}」一致`);
      if (typeof map.title !== "string" || !map.title.trim()) errors.push(`${entry.file}.title: 必须是非空字符串`);
      checkNode(map.root, `${entry.file}.root`, new Set(), true, null);
    }
  }
}

if (errors.length) {
  console.error(`脑图校验失败，共 ${errors.length} 个问题：`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`脑图校验通过：${checkedFiles.length} 张脑图（${checkedFiles.join("、")}）`);
