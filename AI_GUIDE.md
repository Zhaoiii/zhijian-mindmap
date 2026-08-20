# AI 协作指南

## 项目用途与结构

枝见是一个可静态部署的网页脑图编辑器。应用源码、仓库脑图、校验工具和 GitHub Pages 配置位于同一仓库。

- `app/`：TypeScript/React 应用源码与脑图类型定义。
- `public/mindmaps/`：可被网页直接读取的脑图 JSON。
- `scripts/validate-mindmaps.mjs`：统一校验脑图清单、结构、ID 和 LaTeX。
- `static/`、`vite.pages.config.ts`：GitHub Pages 静态入口与构建配置。
- `.github/workflows/deploy-pages.yml`：默认分支推送后的自动部署。
- `dist/`、`dist-pages/`、`.next/`：构建产物，禁止 AI 直接修改或提交。

## 仓库脑图清单

脑图文件全部位于 `public/mindmaps/`。`public/mindmaps/index.json` 是网页启动时读取的脑图清单。每个清单项包含：

```json
{
  "id": "data-analysis",
  "title": "资料分析知识框架",
  "file": "data-analysis.json",
  "description": "公务员考试资料分析知识点与常用公式"
}
```

新增、改名或删除脑图文件时，必须同步更新 `index.json`。`file` 只能是当前目录下的 `.json` 文件名，不能包含路径跳转。

## 脑图 JSON 完整结构

```json
{
  "version": 1,
  "id": "sample-map",
  "title": "示例脑图",
  "root": {
    "id": "root",
    "text": "中心主题",
    "side": "center",
    "color": "#2D3038",
    "collapsed": false,
    "children": [
      {
        "id": "growth",
        "text": "增长率\n$r=\\frac{增长量}{基期量}$",
        "side": "left",
        "color": "#6758E8",
        "collapsed": false,
        "children": []
      }
    ]
  }
}
```

字段定义：

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `version` | `1` | 当前只支持版本 1 |
| `id` | 字符串 | 脑图或节点的稳定唯一标识 |
| `title` | 字符串 | 脑图显示标题 |
| `root` | 节点 | 唯一根节点 |
| `text` | 字符串 | 普通文字和原始 LaTeX；可以换行 |
| `side` | `left` / `right` / `center` | 仅根节点用 `center`；后代继承一级分支方向 |
| `color` | `#RRGGBB` | 一级分支颜色；后代使用同色 |
| `collapsed` | 布尔值 | `true` 时隐藏后代，但不删除数据 |
| `children` | 节点数组 | 无子节点时也必须写 `[]` |

## 节点 ID 规范

- 同一张脑图中的每个节点 ID 必须唯一。
- 根节点固定使用 `root`。
- 推荐使用小写英文和连字符，如 `growth-rate-current`；同组节点使用稳定前缀。
- 修改现有脑图时尽量保留原有节点 ID，避免链接、外部引用和后续差异追踪失效。
- 删除后不要立即把旧 ID 用于语义不同的新节点。

## 左右分支

根节点直属子节点设置 `side: "left"` 或 `side: "right"`。其所有后代必须使用相同方向和分支颜色。要把完整一级分支移到另一侧，递归修改该分支全部节点的 `side`；不要只修改父节点。

## 新增、修改和删除节点

- 新增：在目标节点的 `children` 数组中加入字段完整的新节点，并确认 ID 唯一。
- 修改：只改所需字段；除非明确要求，不要重排无关节点，也不要重命名 ID。
- 删除：从父节点的 `children` 中删除整个节点对象；删除会同时删除其全部后代。
- 删除脑图文件：同时从 `index.json` 删除对应清单项。

## LaTeX 与 JSON 转义

- 行内公式：`$r=\frac{增长量}{基期量}$`。
- 独立公式：`$$r_{间隔}=r_1+r_2+r_1r_2$$`。
- JSON 字符串中的反斜杠必须写成两个反斜杠。例如 LaTeX 源码 `\frac{a}{b}` 在 JSON 文件中写作 `\\frac{a}{b}`。
- 换行使用 `\n`。普通文字和多个公式可以共存于同一个 `text`。
- 不写 HTML 或 JavaScript。KaTeX 以 `trust: false` 渲染，危险命令不会执行；无效公式会在网页中显示原文，但校验命令会提示修复。

## 校验 JSON

每次修改脑图后必须在仓库根目录运行：

```bash
npm run validate:maps
```

该命令检查 JSON 语法、清单和文件对应关系、必填字段、节点 ID 唯一性、分支方向、颜色格式与 LaTeX。AI 完成修改后必须运行此命令；不能用肉眼检查代替。

## 本地预览

```bash
npm install
npm run dev
```

打开终端显示的本地地址。检查仓库脑图列表、节点布局、折叠状态和公式。GitHub Pages 专用静态构建使用：

```bash
npm run build:pages
```

## 提交与部署

1. 运行 `npm run validate:maps`。
2. 运行 `npm run build:pages`。
3. 只提交源码、脑图数据与配置；不要提交 `dist/`、`dist-pages/` 或 `.next/`。
4. 提交并推送到默认分支 `main`。
5. GitHub Actions 自动构建并更新 GitHub Pages；在仓库 Actions/Deployments 页面确认成功。

不要把密钥、令牌、邮箱、私人笔记或其他个人信息放入脑图和仓库。

## 添加一张脑图

1. 在 `public/mindmaps/` 新建 `new-map.json`。
2. 按统一 JSON 结构填写脑图。
3. 在 `public/mindmaps/index.json` 添加清单记录。
4. 运行脑图校验命令。
5. 运行项目构建，确认公式和节点正常显示。

## 可直接交给 AI 的操作模板

```text
请在这个仓库中新增或修改一张脑图。

脑图名称：
目标文件：
需要添加或修改的内容：

要求：
1. 先阅读仓库根目录的 AI_GUIDE.md。
2. 遵守脑图 JSON 结构和节点 ID 规范。
3. 公式使用 LaTeX，并正确处理 JSON 反斜杠转义。
4. 更新 public/mindmaps/index.json。
5. 不要修改构建产物。
6. 完成后运行脑图校验和项目构建。
7. 汇报修改的文件、节点和验证结果。
```
