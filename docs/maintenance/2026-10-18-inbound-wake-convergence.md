---
doc_type: report
project: pi-intercom
status: active
truth_mode: maintained
created: 2026-10-18
owner: chx
---

# Inbound message wake convergence

普通 peer `send` 消息默认是上下文状态，不自动启动新的模型回合。`inboundTrigger` 的默认值从 `always` 收敛为 `replies`；显式 ask、reply，或普通 send 携带 `wake: true` 仍可触发非阻塞关注。显式 `always` 和 `never` 配置保留，便于旧流程和受控环境选择。

Pi 1.3+ 使用原生 custom-message trigger，保留 `before_agent_start` 和结构化来源；旧宿主继续使用兼容 user-prompt wake。共享 idle reservation、busy delivery、消息去重、ask/reply 路由与队列终态保持不变。

本次不修改共享运行中的 broker 或现有 session；新代码安装/重启是独立边界。provider-free 全量 synthetic suite：341 passed、1 skipped、0 failed。覆盖普通状态不唤醒、明确 ask/reply 唤醒、显式 `wake: true` 不创建假 pending ask、旧宿主兼容及共享 reservation。旧 all-message/human-first 断言以显式 `always` 配置保留；配置夹具必须恢复原始字节，不得污染后续案例。
