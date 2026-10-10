# Pi Intercom

[English](README.md) | 中文

在同一台机器上的 Pi 会话之间进行直接的一对一通信。本仓库是上游 intercom 扩展的维护 fork：`chenhaoxiang/pi-intercom`。

> Fork 仓库：<https://github.com/chenhaoxiang/pi-intercom>
>
> **pi-intercom** 适合一对一对话；共享在线状态、文件占用和 Crew 工作流请使用 [pi-messenger](https://github.com/chenhaoxiang/pi-messenger)。

## 发布版本与分支约定

当前维护版本为 **0.17.0-fork.1**，基于社区 **0.17.0**。fork 版本统一使用 `<社区版本>-fork.<修订号>`，本地修订不冒充社区新版本。

- `main`：我们的维护、整合与发布主线，保留 fork 修复。
- `upstream-main`：仅镜像社区 `main`，不加入 fork 提交，也不作为安装来源。
- 改动通过经过审核的 PR 合入 `main`；保留现有分支和历史。

固定版本安装：

```bash
pi install git:github.com/chenhaoxiang/pi-intercom@v0.17.0-fork.1
```

[GitHub Releases](https://github.com/chenhaoxiang/pi-intercom/releases) 提供可安装的包、来源清单和 `SHA256SUMS` 校验文件；这不是向上游作者的 npm 命名空间发布。发布及制品安装流程见[维护说明](docs/releasing.md)。

## 安装本 fork

```bash
pi install git:github.com/chenhaoxiang/pi-intercom@main
```

安装后重启 Pi 或执行 `/reload`。需要可复现安装时，可固定经过审核的提交：

```bash
pi install git:github.com/chenhaoxiang/pi-intercom@<reviewed-commit>
```

第一个启用该扩展的会话连接时，扩展会自动启动或重新连接本地 broker。正常的 macOS/Linux 路径不依赖远程服务，也不会监听网络端口。

## 快速开始

先为当前会话命名，便于其他会话稳定寻址：

```text
/alias planner
```

按 **Alt+M** 或输入 `/intercom` 打开会话选择器，也可以直接使用工具：

```ts
intercom({ action: "list" })
intercom({ action: "send", to: "worker", message: "请检查解析器的边界情况。" })
intercom({ action: "ask", to: "planner", message: "哪些兼容行为必须保留？" })
intercom({ action: "reply", replyTo: "message-id", message: "保留现有行为，并补一条回归测试。" })
intercom({ action: "status" })
```

`send` 是发送后立即返回；`ask` 要求目标当前已连接，并等待对方回复，回复会作为工具结果返回。目标断开时，`ask` 会立即失败，不会留下一个无法结束的阻塞请求。

需要交接会话时，可以在选择器中按 `h`，或调用：

```ts
intercom({ action: "handover", to: "worker", message: "继续当前计划，并核对剩余测试。" })
```

## Fork 维护内容

本 fork 保留原有 intercom 体验，并为长期运行的本地 Pi 会话补充可靠性边界：

- 社区 0.17.0 修复：会话池隔离、接收方确认投递、失联会话清理、broker 重连重试和共享空闲唤醒；
- broker 重启和 Pi reload 后仍可恢复的 `ask` / `reply` 路由；发送方丢失原投递回执后，使用原消息 ID 重放仍会显示“结果未确认”，重试必须使用新消息 ID；
- 明确的消息 ID、发送序号、时间戳、投递状态和回复提示；
- 有界去重：同一消息在一个接收会话中最多注入一次；
- 显式取消和同发送方 supersede，禁止不透明的自动重试；
- 通过 `PI_INTERCOM_SCOPE_ID` 使用可选路由域，隔离 scoped 与 unscoped 会话；
- 使用 `stableId` 或 `PI_INTERCOM_STABLE_ID` 保持重启后的地址稳定；从 0.17.0 起，每个活跃会话必须有独立的稳定 ID；旧配置若共用一个 `stableId`，请为各会话设置独立的 `PI_INTERCOM_STABLE_ID`，升级后待任务结束再关闭全部 Pi 会话一次；
- liveness 心跳，以及 broker 消失后的自动重连；
- 通过 `busyDelivery: "steer"` 或 `"human-first"` 控制消息如何进入忙碌的交互会话；
- 与 pi-subagents 桥接：只有携带桥接元数据的委派子会话才会获得 `contact_supervisor`。

收到的消息可以配置为立即触发一轮、仅回复消息时触发，或完全不自动触发。暂存消息始终可观测，并以 `cancelled`、`superseded`、`acknowledged` 或 `expired` 等明确终态结束，不会静默消失。

## 投递模型

每个启用的会话都会注册到本地 broker。broker 可以按稳定会话 ID、名称、ID 前缀或明确指定的工作目录路由消息。`list` 只展示已连接的 intercom 会话，不会把任意打开的 Pi 进程自动视为可寻址目标。

普通传输使用本地 IPC：

- macOS/Linux 使用 Unix socket；
- Windows 使用 named pipe；
- 只有在环境无法使用 named pipe 且显式配置时，才使用 localhost TCP 备用路径。

broker 首次使用时自动启动，空闲一段时间后退出，并受启动锁保护。broker 重启后，客户端会沿已有重连路径恢复。启用跨机器能力时，通过明确选择的 Herdr machine 经 SSH 中继；普通本地发送不会退回到远程发现。

## 配置

全局状态与配置默认位于：

```text
~/.pi/agent/intercom/
```

设置 `PI_CODING_AGENT_DIR` 后，扩展改用 `$PI_CODING_AGENT_DIR/intercom`。目录中包含 broker socket/pipe、PID 和锁状态、队列邮箱数据以及 `config.json`。

常用配置示例：

```json
{
  "inboundTrigger": "always",
  "busyDelivery": "steer",
  "replyHint": true,
  "confirmSend": false,
  "stableId": "planner"
}
```

- `inboundTrigger`：broker 消息触发策略，可选 `always`、`replies`、`never`；
- `busyDelivery`：`steer` 立即交给当前提示，或 `human-first` 等待安全的 turn 边界；
- `stableId`：可选的重启稳定会话身份；每个活跃会话使用独立值；从 0.16.x 升级且此前共用该值时，待任务结束再关闭全部 Pi 会话一次；
- `confirmSend`：发送前是否要求 UI 确认；
- `status`：在 Pi 生命周期状态后追加自定义状态，不覆盖原状态。

默认 `ask` 阻塞等待时间为 10 分钟。可以用正整数毫秒覆盖：

```bash
export PI_INTERCOM_ASK_TIMEOUT_MS=600000
```

其他运行时参数包括 `PI_INTERCOM_SCOPE_ID`、`PI_INTERCOM_STABLE_ID`、`PI_INTERCOM_LIVENESS_INTERVAL_MS` 和 `PI_INTERCOM_LIVENESS_TIMEOUT_MS`。

配置无效时会对 broker 入站自动触发采取 fail-closed 行为，暂时使用 `inboundTrigger: "never"`，直到修正配置文件。

## 与 pi-subagents 集成

当 pi-subagents 提供桥接元数据时，委派子会话会获得仅子会话可见的 `contact_supervisor` 工具：

- `need_decision`：子会话被产品、API 或范围决策阻塞时使用；
- `interview_request`：需要一次取得多个结构化答案时使用；
- `progress_update`：计划发生有意义变化时发送非阻塞进度更新。

普通会话继续使用 `intercom` 工具。Intercom 不替代有界委派：隔离实现任务使用 pi-subagents，持久的 peer 对话或人工可见交接使用 intercom。

## 安全与隐私

- 默认情况下消息只在本机传输，不离开机器；
- cwd、模型、PID、状态等客户端信息是展示元数据，不是认证凭据；
- 路由域边界严格生效，scoped 会话看不到 unscoped 会话；
- 取消不会假装撤回已经注入 Pi 队列的工作；
- 不执行自动重试。需要重试时应编写新消息，并用 `retryOf` 关联原消息；
- 队列消息、会话历史和调试/运行时文件都属于本地协作数据，应妥善保护。

## 开发

```bash
npm install
npm test
```

测试使用本地 fixture 和合成 broker/session 状态，不使用生产凭据或私人对话内容。本包是带本地 broker 的 Pi 扩展，安装不会创建系统级 daemon。

## 许可证

MIT
