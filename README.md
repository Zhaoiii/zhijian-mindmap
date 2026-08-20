# 枝见（Zhijian Mind Map）

一个由仓库 JSON 驱动的只读网页版脑图浏览器。网页负责展示、公式渲染和浏览交互，脑图源码统一保存在 `public/mindmaps/`，适合让 AI 直接维护内容并通过 GitHub Pages 自动发布。

## 功能

- 从 `public/mindmaps/index.json` 读取仓库脑图清单
- 中心主题与左右分支布局，不同一级分支使用不同颜色
- 节点、大纲和节点详情联动
- 单节点或一键展开/收起分支
- 鼠标、触摸拖动画布，滚轮或触控板缩放，一键适应画布
- 左右侧栏可独立收起；移动端使用抽屉，尽可能保留画布空间
- KaTeX 渲染行内和独立 LaTeX 公式
- TypeScript 数据类型、浏览器运行时校验和命令行校验
- GitHub Actions 自动构建并部署到 GitHub Pages

网页不提供新建、编辑、导入、导出、本地草稿或 Issue 保存功能。内容变更只通过仓库中的 JSON 文件完成。

## 本地安装与运行

需要 Node.js 22 或更高版本。

```bash
npm install
npm run dev
```

终端会显示本地预览地址。常用命令：

```bash
npm run validate:maps  # 校验脑图清单、结构、ID、分支和公式
npm run build:pages    # 构建 GitHub Pages 静态站点
npm run lint           # 检查 TypeScript/React 代码
npm run verify         # 完整校验与两套构建
```

## 新增仓库脑图

每张脑图是 `public/mindmaps/` 中的一个独立 JSON 文件。

1. 复制 `public/mindmaps/example.json`，例如保存为 `my-map.json`。
2. 修改脑图 `id`、`title` 和节点内容，并使用稳定且唯一的节点 ID。
3. 在 `public/mindmaps/index.json` 的 `maps` 数组中添加清单项。
4. 运行 `npm run validate:maps`。
5. 运行 `npm run verify` 并在本地确认显示结果。

完整规范和可直接交给 AI 的操作模板见 [AI_GUIDE.md](AI_GUIDE.md)。

## 脑图 JSON 格式

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

每个节点必须包含：

- `id`：同一张脑图内稳定且唯一的节点标识。
- `text`：普通文字与原始 LaTeX。
- `side`：根节点为 `center`，其他节点为 `left` 或 `right`。
- `color`：`#RRGGBB` 格式；后代通常继承一级分支颜色。
- `collapsed`：页面首次打开时是否收起后代。
- `children`：子节点数组，无子节点时也必须写 `[]`。

## 公式书写

- 行内公式：`$r=\frac{增长量}{基期量}$`
- 独立公式：`$$r_{间隔}=r_1+r_2+r_1r_2$$`
- 普通文字、换行和多个公式可以出现在同一节点中。
- JSON 字符串中的反斜杠需要转义：LaTeX `\frac` 在 JSON 文件中写为 `\\frac`。
- 无效公式会显示原文，不会使页面崩溃。

## AI 协作

让 AI 修改脑图前，要求它先阅读根目录的 [AI_GUIDE.md](AI_GUIDE.md)。推荐流程：

1. AI 修改或新增 `public/mindmaps/*.json`。
2. 新增、改名或删除脑图时同步修改 `public/mindmaps/index.json`。
3. AI 运行 `npm run validate:maps` 和 `npm run verify`。
4. AI 汇报涉及的文件、节点 ID 和验证结果。
5. 提交并推送后，GitHub Actions 自动更新页面。

## GitHub Pages 部署

仓库包含 `.github/workflows/deploy-pages.yml`。在仓库 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**；之后每次推送到 `main` 都会校验脑图、构建 `dist-pages/` 并发布。

应用使用相对路径加载静态资源和 `mindmaps/*.json`，兼容 `https://用户名.github.io/仓库名/` 形式的仓库子路径。构建产物由流水线生成，不应手动提交。

## 安全

- 节点文字由 React 转义，不执行脑图中的 HTML 或 JavaScript。
- KaTeX 使用 `trust: false`，不允许危险命令。
- 清单和每张脑图都会先通过数据结构校验再显示。
- 项目不需要 GitHub Token、OAuth 密钥或后端服务。
- 不要把密钥、令牌、邮箱、私人笔记或个人信息放入公开仓库。
- `dist/`、`dist-pages/`、`.next/` 等构建产物不应手动修改或提交。

## 技术栈

React 19、TypeScript、Vite、KaTeX、GitHub Actions、GitHub Pages。
