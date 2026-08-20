# 枝见（Zhijian Mind Map）

一个接近 XMind 使用体验的现代网页版脑图编辑器。它支持左右分支、节点编辑、画布拖拽缩放、本地自动保存、GitHub Issue 版本以及安全的 LaTeX 公式渲染，可完全静态部署到 GitHub Pages。

## 功能

- 中心主题与向左/向右一级分支
- 新增、删除、重命名、编辑子主题与同级主题
- 节点展开/折叠，大纲同步显示
- 鼠标或触摸拖动画布，滚轮缩放，一键适应画布
- 浏览器 `localStorage` 自动保存，刷新后恢复
- 导入、导出统一结构的 JSON；非法文件不会覆盖当前脑图
- 启动时读取同仓库 `public/mindmaps/index.json`，按清单打开仓库脑图
- KaTeX 行内与独立公式，编辑时保留原始 LaTeX
- 桌面三栏工作台与移动端抽屉式基本编辑
- 左右侧栏可独立收起，移动端关闭抽屉后使用完整画布
- GitHub Issue 脑图清单、评论版本读取和“复制并打开 GitHub”保存流程
- TypeScript 数据类型、运行时校验与仓库脑图命令行校验
- GitHub Actions 自动部署 GitHub Pages

## 本地安装与运行

需要 Node.js 22 或更高版本。

```bash
npm install
npm run dev
```

终端会显示本地预览地址。修改源码后页面会自动更新。

常用命令：

```bash
npm run validate:maps  # 校验仓库脑图与公式
npm run build:pages    # 构建 GitHub Pages 静态站点
npm run lint           # TypeScript/React 代码检查
npm run verify         # 完整验证
```

## 新增仓库脑图

仓库脑图位于 `public/mindmaps/`，一张脑图对应一个 JSON 文件。

1. 复制 `public/mindmaps/example.json` 为新的文件，例如 `my-map.json`。
2. 修改脑图的 `id`、`title`、节点内容和稳定 ID。
3. 在 `public/mindmaps/index.json` 的 `maps` 数组添加清单项。
4. 运行 `npm run validate:maps`。
5. 运行 `npm run build:pages`。

完整字段规则、ID 规范和 AI 操作模板见 [AI_GUIDE.md](AI_GUIDE.md)。

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

每个节点必须包含 `id`、`text`、`side`、`color`、`collapsed` 和 `children`。根节点方向固定为 `center`；其他节点方向为 `left` 或 `right`，并继承所属一级分支方向。

## 导入与导出

- 点击顶部“导入”选择 `.json` 文件。应用先进行完整校验；出错时显示原因，并保留当前脑图。
- 点击“导出”下载当前脑图。导出文件保留原始 LaTeX、节点 ID、颜色与折叠状态。
- 导入内容只按文字与公式处理，不会执行其中的 HTML 或 JavaScript。

## 公式书写

- 行内公式：`$r=\frac{增长量}{基期量}$`
- 独立公式：`$$r_{间隔}=r_1+r_2+r_1r_2$$`
- 普通文字、换行和多个公式可以放在同一个节点中。
- JSON 文件中的 LaTeX 反斜杠需要转义：源码 `\frac` 在 JSON 中写成 `\\frac`。
- 编辑框显示原始 LaTeX，节点与实时预览使用 KaTeX 渲染。
- KaTeX 关闭信任模式；解析失败时显示原始公式，不会使页面崩溃。

## AI 协作

让 AI 修改脑图前，要求它先阅读根目录的 [AI_GUIDE.md](AI_GUIDE.md)。该指南包含项目结构、完整字段表、节点 ID 规范、公式转义、清单更新、禁止修改的构建目录以及强制验证步骤。

最短工作流：

1. 修改或新增 `public/mindmaps/*.json`。
2. 同步更新 `public/mindmaps/index.json`。
3. 运行 `npm run validate:maps` 和 `npm run build:pages`。
4. 汇报改动节点与验证结果。

## GitHub Pages 部署

仓库已包含 `.github/workflows/deploy-pages.yml`。在 GitHub 仓库的 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。之后每次推送到 `main`，工作流会：

1. 安装锁定依赖。
2. 校验所有仓库脑图和 LaTeX。
3. 使用相对资源路径构建静态站点。
4. 发布 `dist-pages/` 到 GitHub Pages。

应用使用相对 URL 加载 `mindmaps/index.json` 与脑图文件，因此兼容 `https://用户名.github.io/仓库名/` 形式的仓库子路径。页面为单入口静态应用，刷新不会触发后端路由请求。

## GitHub Issue 脑图

个人脑图可以不写入仓库文件，而是保存在公开 Issue 中。网页会读取仓库中由 `Zhaoiii` 创建、标题以 `[mindmap]` 开头的开放 Issue，并从本人发布的评论中选择最新一份结构合法的脑图 JSON。

保存已有 Issue 脑图：

1. 在网页点击“保存到 Issue”。
2. 点击“复制并打开 GitHub”。
3. 将内容粘贴为一条新评论并提交。
4. 返回网页，在左侧刷新 Issue 清单并重新打开该脑图。

保存新脑图时流程相同，但 GitHub 会打开新 Issue 页面；把内容粘贴到描述中并创建。创建后建议锁定会话，只有仓库所有者和具有写权限的人还能继续评论。每条合法评论都是一个完整版本，因此可以直接在 GitHub 查看历史或复制旧评论回滚。

评论内容格式：

````markdown
<!-- zhijian-mindmap:v1 -->

```json
{
  "version": 1,
  "id": "sample-map",
  "title": "示例脑图",
  "root": {}
}
```
````

Issue 数据通过 GitHub 公共 REST API 读取，不需要 GitHub App、Serverless、令牌或密钥。公开接口有访问频率限制；本地草稿仍由浏览器自动保存，因此暂时读取失败不会丢失正在编辑的内容。

## 安全与隐私

- 不依赖自建后端，也不在网页中保存 GitHub 令牌或密码。
- 只接受 `Zhaoiii` 创建的 `[mindmap]` Issue 和本人评论中的合法 JSON；其他评论会被忽略。
- Issue 位于公开仓库，脑图内容也是公开的，不要保存隐私或敏感信息。
- 节点文字由 React 转义；只对提取出的公式调用 KaTeX。
- KaTeX 使用 `trust: false`，不允许危险命令。
- 仓库脑图和导入文件均先校验结构及节点 ID。
- 不要把令牌、密钥、邮箱、私人笔记或个人信息提交到公开仓库。
- `dist/`、`dist-pages/`、`.next/` 等构建产物已忽略，不应手动提交。

## 技术栈

React 19、TypeScript、Vite、KaTeX；源码可同时用于本地预览与 GitHub Pages 静态构建。
