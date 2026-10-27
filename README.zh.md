# dsh-panel-order（面板排序）

拖拽侧栏的全局面板条目，把常用的挪到顺手的位置 —— 用的就是会话列表那套拖拽手势。顺序会保存，刷新后还在。

DeepSeek Harness 的侧栏顶部有一排全局面板（插件、Skill / MCP、插件市场、自动化任务、记忆管理……），它们的顺序由每个插件注册到 `sidebar.panellist` 槽位时传的 `order` 决定。这个值在注册那一刻就固定了，界面上没有任何地方能改；而它下面的会话列表是可以随意拖着排的。

这个插件补上的就是缺的那半：按住面板行，拖走，松手。

## 特性

- 按住任意一条全局面板行，上下拖动即可换位。
- 指针移动超过 4px 才算拖拽，普通点击照常打开面板。
- 拖动时有蓝色插入线指示落点。
- 侧栏展开和折叠成图标条时都生效，两种形态共用同一套顺序。
- 「更多」始终固定在最后。
- 顺序会保存，每次打开页面自动还原。
- 之前没拖过的面板（比如后来新装的插件）会接在你排好的序列后面，不会被塞进中间。
- 卸载插件后，下次加载恢复成插件注册时的原顺序。

## 安装

### 从本地目录安装

把本目录登记为运行 Web UI 那个 profile 的 bundle：

```
dsh plugin --profile <profile 名> add link:<本目录绝对路径>
```

CLI 会把请求转给 pnpm 并自己维护 profile 的 bundle 列表，不要手改 profile 清单。如果你的插件管理器有「安装 bundle」入口，指向同一个目录即可。

装完重启应用或刷新页面 —— 插件注册的是 Client 模块，浏览器需要重新加载它。

### 环境要求

- DeepSeek Harness 0.2.x，带 Web UI（桌面版，或自己起的 web 实例）。
- 没有外部依赖、没有常驻服务、不需要 API key、没有构建步骤。

## 使用

1. 按住侧栏全局面板列表里的某一行。
2. 指针移动超过 4px 并继续移动；被拖的行变半透明，一条蓝色插入线跟着指针走。
3. 松开即落位，列表立刻重排。
4. 想刷新就刷新，顺序不会丢。

顺序存在 `localStorage` 的 `dsh-panel-order.v1` 里。清掉站点数据就会回到默认。

## 工作原理

1. 通过 `ctx.slots.entriesOfSlot('sidebar.panellist')` 读实时面板注册表，拿到每条条目的 `id`、`order`、`label`。
2. 松手时把新的 `order` 值（`0, 10, 20, …`）写回这些注册对象。
3. 触发一次槽位变更，让侧栏重算面板快照 —— 注册一条一次性条目再立刻注销 —— 于是行按新顺序重新渲染，DOM 顺序、`Tab` 键顺序和「更多」菜单也一起跟上。
4. 保存 id 序列，每次加载时重放。

第 2、3 步用的是上游没有承诺为稳定 API 的内部结构。如果上游改动它们，失效形态是「拖了不生效」：侧栏、面板和别的插件都照常工作，卸载后不留痕迹。

## 局限

- 行与条目靠渲染出来的 label 对应。如果两个面板的 label 完全一样，它们会被跳过，而不是乱排。
- 被收进「更多」的面板保持原来的相对位置，拖拽只重排当前可见的行。
- 顺序存在 `localStorage`，按页面 origin 隔离。桌面版从固定端口提供界面，所以重启不丢；用随机端口（`--port 0`）起的 web 实例会换成新 origin，退回注册顺序。
- 暂时只支持指针拖拽，没有键盘排序。

## 兼容性

- DeepSeek Harness 0.2.x，仅 Web UI（桌面版与自建 web 实例共用同一套 Client 模块格式）。
- 关于把面板顺序做成官方能力的讨论帖：[deepseek-harness discussions #11198](https://github.com/deepseek-ai/deepseek-harness/discussions/11198)。

## 开发

```
npm test
```

测试是静态检查：manifest 字段、bundle patch、Client 模块的语法与 id、本地化资源、图标格式与大小、宿主入口导出。行为验证靠真机：拖一行、刷新页面看顺序。

```
client.js         Client 模块：拖拽处理、写 order、持久化
index.js          宿主半（空的；这个包只需要 Client 模块）
cordis.patch.yml  bundle patch，插入插件行
locale/en.json    插件标题与描述（另有 zh.json）
icon.svg          插件图标
scripts/check.mjs `npm test` 背后的静态检查
```

## 许可证

Apache-2.0，见 [LICENSE](LICENSE)。
