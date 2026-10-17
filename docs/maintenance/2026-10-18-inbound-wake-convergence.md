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

Pi 1.3+ 使用原生 custom-message trigger，保留 `before_agent_start` 和结构化来源；旧宿主继续使用兼容 user-prompt wake。跨机 explicit `wake`/handover 使用 relay envelope v2；普通跨机 send 保持 v1，旧远端不会被静默降级，版本不匹配会 fail closed。共享 idle reservation、busy delivery、消息去重、ask/reply 路由与队列终态保持不变。

本次不修改共享运行中的 broker 或现有 session；新代码安装/重启是独立边界。provider-free 初轮 synthetic suite：341 passed、1 skipped；审查修复后含 relay v2、协议指纹及接收方 never 优先回归的全量 suite：347 passed、1 skipped、0 failed。覆盖普通状态不唤醒、明确 ask/reply 唤醒、显式 `wake: true` 不创建假 pending ask、旧宿主兼容及共享 reservation。Pi 1.3.0-fork.1 packaged smoke 观察 `beforeAgentStart:["user","custom"]`、普通状态0回合、explicit wake 1回合、0 synthetic user wake、0 real provider calls。旧 all-message/human-first 断言以显式 `always` 配置保留；配置夹具必须恢复原始字节，不得污染后续案例。
