# AI 协作指南

## 项目用途与整体结构

枝见是一个静态、只读的网页脑图浏览器。网页不编辑或保存内容；所有脑图源码都放在当前 GitHub 仓库中，由开发者或 AI 修改 JSON 后通过 GitHub Pages 发布。

- `app/`：TypeScript/React 浏览器源码与数据类型。
- `app/lib/mindmap.ts`：脑图类型和浏览器运行时校验。
- `public/mindmaps/`：唯一的脑图内容数据源。
- `public/mindmaps/index.json`：网页启动时读取的脑图清单。
- `scripts/validate-mindmaps.mjs`：清单、结构、ID、分支和 LaTeX 校验工具。
- `.github/workflows/deploy-pages.yml`：推送默认分支后的自动部署流程。
- `dist/`、`dist-pages/`、`.next/`：构建产物，禁止 AI 直接修改或提交。

若用户只要求新增或修改脑图，不要修改 `app/`、构建配置或工作流。

## 脑图目录与 index.json

每张脑图对应 `public/mindmaps/` 中的一个独立 `.json` 文件。`public/mindmaps/index.json` 决定网页显示哪些脑图以及排列顺序：

```json
{
  "maps": [
    {
      "id": "data-analysis",
      "title": "资料分析知识框架",
      "file": "data-analysis.json",
      "description": "公务员考试资料分析知识点与常用公式"
    }
  ]
}
```

清单字段：

| 字段 | 规则 |
| --- | --- |
| `id` | 脑图的稳定唯一标识，应与文件内顶层 `id` 一致 |
| `title` | 列表中显示的脑图名称 |
| `file` | 当前目录内的 `.json` 文件名，不能包含路径跳转 |
| `description` | 列表中的简短说明 |

新增、改名或删除脑图文件时必须同步修改 `index.json`。只修改现有脑图内容时，不要无意义地改动清单。

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
| 顶层 `id` | 字符串 | 脑图稳定唯一标识 |
| `title` | 字符串 | 脑图显示标题 |
| `root` | 节点 | 唯一根节点 |
| 节点 `id` | 字符串 | 同一张脑图内稳定且唯一 |
| `text` | 字符串 | 普通文字和原始 LaTeX，可以换行 |
| `side` | `left` / `right` / `center` | 仅根节点使用 `center` |
| `color` | `#RRGGBB` | 一级分支颜色，后代使用同色 |
| `collapsed` | 布尔值 | 页面首次打开时是否隐藏后代 |
| `children` | 节点数组 | 无子节点时也必须写 `[]` |

每个节点都必须显式包含 `id`、`text`、`side`、`color`、`collapsed` 和 `children`，不要省略字段。

## 节点 ID 命名规范

- 根节点固定使用 `root`。
- 推荐使用小写英文和连字符，例如 `growth-rate-current`。
- 同组节点使用稳定前缀，例如 `growth-rate-definition`、`growth-rate-formula`。
- 同一张脑图中的节点 ID 不得重复。
- 修改现有脑图时应尽量保留原有节点 ID，避免链接、引用和差异追踪失效。
- 删除节点后，不要立即把旧 ID 用于语义不同的新节点。

## 左右分支设置

根节点直属子节点设置 `side: "left"` 或 `side: "right"`。一个一级分支的所有后代必须保持相同方向和颜色。

将完整分支移到另一侧时，应递归修改该一级分支及全部后代的 `side`；不要只修改父节点。颜色同理，修改一级分支颜色时应同步其后代。

## 新增、修改和删除节点

- 新增节点：在目标父节点的 `children` 中加入字段完整的新节点，并确认 ID 唯一、方向和颜色继承正确。
- 修改节点：只修改用户要求的字段；除非明确要求，不要重排无关节点或更换 ID。
- 删除节点：从父节点的 `children` 中删除整个对象；其所有后代会一起删除。
- 新增脑图：新建 JSON 文件并在 `index.json` 中添加清单项。
- 删除脑图：删除对应 JSON 文件并从 `index.json` 删除清单项。

不要通过修改 React 源码硬编码脑图内容。

## LaTeX 公式与 JSON 转义

- 行内公式：`$r=\frac{增长量}{基期量}$`
- 独立公式：`$$r_{间隔}=r_1+r_2+r_1r_2$$`
- 普通文字和多个公式可以共存在一个 `text` 中。
- JSON 字符串中的一个反斜杠必须写成两个反斜杠。例如 LaTeX `\frac{a}{b}` 在 JSON 文件中写作 `\\frac{a}{b}`。
- 换行使用 `\n`。
- 不要写 HTML 或 JavaScript。KaTeX 使用 `trust: false`；危险命令不会执行。
- 公式解析失败时网页会显示原文，但 AI 应根据校验错误修正公式后再提交。

## 校验 JSON

每次修改脑图后必须在仓库根目录运行：

```bash
npm run validate:maps
```

该命令检查 JSON 语法、清单与文件对应关系、字段、节点 ID、分支方向、颜色和 LaTeX。不能用肉眼检查替代。

AI 完成所有修改后还必须运行完整验证：

```bash
npm run verify
```

只有两个命令都成功，任务才算完成。

## 本地预览

```bash
npm install
npm run dev
```

打开终端显示的本地地址，检查：

1. 新增或修改的脑图能从左侧列表打开。
2. 左右分支、层级和颜色正确。
3. 长文本和公式显示完整。
4. 展开、收起、拖动、缩放和适应画布正常。
5. 桌面端与移动端侧栏可正常开合。

GitHub Pages 专用静态构建命令：

```bash
npm run build:pages
```

## 提交修改并触发部署

1. 运行 `npm run validate:maps`。
2. 运行 `npm run verify`。
3. 只提交源码、脑图 JSON 和必要配置。
4. 禁止提交 `dist/`、`dist-pages/`、`.next/` 或其他构建产物。
5. 提交并推送到默认分支 `main`。
6. GitHub Actions 自动构建并更新 GitHub Pages。
7. 在仓库 Actions/Deployments 页面确认流水线成功。

不要向仓库提交密钥、令牌、邮箱、私人笔记或个人信息。

## 添加一张脑图

1. 在 `public/mindmaps/` 新建 `new-map.json`。
2. 按统一 JSON 结构填写完整脑图。
3. 在 `public/mindmaps/index.json` 添加清单记录。
4. 运行 `npm run validate:maps`。
5. 运行 `npm run verify`。
6. 本地打开页面，确认公式、节点和布局正常。

## 修改一张现有脑图

1. 找到 `public/mindmaps/index.json` 中的清单项和对应文件。
2. 只修改目标节点，尽量保留已有节点 ID 和无关内容顺序。
3. 如果没有新增、改名或删除脑图，不要修改 `index.json`。
4. 运行 `npm run validate:maps` 和 `npm run verify`。
5. 汇报修改的文件、节点 ID 和验证结果。

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
4. 新增、改名或删除脑图时更新 public/mindmaps/index.json；仅修改现有内容时不要无意义改动清单。
5. 不要修改网页源码或构建产物，除非任务明确要求。
6. 尽量保留现有节点 ID。
7. 完成后运行 npm run validate:maps 和 npm run verify。
8. 汇报修改的文件、节点 ID 和验证结果。
```
