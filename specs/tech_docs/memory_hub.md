# MemoryHub 与工作回顾

> 状态：当前实现的权威说明
> 更新：2026-07-22

## 1. 所有权与事实源

`MemoryHub` 是 Rust Desktop Core 管理的本地投影层。Session、Task、Thought、Cron 和 ToolAttachment 原文件仍是唯一事实源；`~/.blexagent/memory-hub/` 中的内容必须可清空并重建。

```text
Session / Task / Thought / Cron / ToolAttachment
                        │
                        ▼
              Rust MemoryHub projector
             ┌──────────┴──────────┐
             ▼                     ▼
       activity ledger       memory/artifact ledger
             │                     │
             └──────────┬──────────┘
                        ▼
               Review UI + recall
```

本地目录：

- `activities/YYYY-MM.jsonl`：确定性活动事件；
- `memories.jsonl`：append-only 记忆版本和删除墓碑；
- `artifacts.jsonl`：append-only 产出物状态；
- `rollups/YYYY-MM-DD.json`：可重建的日汇总；
- `reports/`：按数据版本缓存的周期报告；
- `checkpoints.json`：数据源指纹和扫描进度；
- `index/`：Tantivy + jieba 中文 BM25 索引；
- `outbox/`：可选外部后端的同步进度与失败队列。

## 2. 采集与一致性

应用启动时扫描一次；文件变化经约 900ms debounce 后扫描；每五分钟再做一次校验。事件 ID 由来源 ID、消息/状态版本确定性生成，因此重复扫描不会产生重复活动。

默认仅回填最近 30 天，可以在设置中改为 1–3650 天。Session 删除后，派生记忆移除对应来源；无剩余来源且不是人工创建的记录写入 `deleted` 墓碑。产出物同样写入删除状态。看板查询会对照当前 Session/Task 事实源，历史投影不会把已删除来源重新计入。

ToolAttachment 只有 `presentation != process` 才是产出物。浏览器过程截图不会进入产出物统计。

## 3. 记忆作用域与召回

作用域固定为：

- `user`：当前用户长期偏好和事实；
- `workspace`：项目决策、目标、流程和状态；
- `agent`：特定智能体知识。

召回只能读取用户层、当前工作区和当前智能体。工作区/智能体作用域没有匹配 ID 时一律拒绝，不允许降级为全局读取。

模型调用前，Sidecar 通过受 capability token 保护的 `POST /api/memory/recall` 获取最多 8 条记忆。Rust 先用 Tantivy/jieba BM25 检索，再叠加重要度、置信度和固定状态排序。索引异常时退回线性匹配；100ms 目标或网络调用失败时 Sidecar fail-open，正常对话继续。

召回内容使用：

```xml
<system-reminder>
  <MEMORY_CONTEXT ids="..."></MEMORY_CONTEXT>
</system-reminder>
```

模型输入包含正文；Session JSONL 只保存可见用户文本和 `memoryContextIds`。记忆上下文不得进入用户气泡、标题、全文搜索或下一轮记忆抽取。

## 4. 记忆维护

每个成功用户—助手轮次先产生带来源的 episodic `project_state` 记录；明确的偏好、事实、目标、决策和流程由保守本地规则另行抽取。这样模型不可用时，活动、回顾和来源闭环仍可工作。

原 24 小时 Memory Update 在启用 MemoryHub 时改为调用工作区投影合并，不再向每个历史会话插入维护消息。MemoryHub 显式关闭时才使用旧兼容路径。72 小时 Gardener 和 14 天 Molt 任务保持不变。

## 5. 回顾与管理界面

顶部“回顾”是单例 Tab，包含概览、产出物、进展、记忆和效率。时间范围按请求中的 IANA 时区（默认界面使用 `Asia/Shanghai`）分组，而不是使用 UTC 日期截断。

设置中的“记忆中台”可以控制采集、召回、三个作用域、回填天数，并提供状态、重建、回填和清空入口。清空只删除派生数据，不删除 Session/Task/Thought 事实源。

## 6. 可选 Mem0 镜像

默认后端始终为 `Local`，不需要 Docker、Token 或额外服务。选择 `Mem0 REST` 后，本地账本和索引仍是事实源与召回降级路径。

Mem0 OSS 地址不带 `/v1`。Blex 通过 `/auth/setup-status` 健康检查，使用 `/memories` 同步；本地 memory ID 映射为 Mem0 `run_id` 以支持确定性替换和删除。若服务启用了认证，从进程环境读取 `BLEX_MEM0_API_KEY`，其次读取 `MEM0_API_KEY`，并通过 `X-API-Key` 发送，密钥不写入 MemoryHub 配置。

每次后台校验最多同步 20 条变更。失败记录保留在 `outbox/`，不得让外部故障影响聊天、活动采集或本地召回。

## 7. 接口

Tauri commands：

- `cmd_insights_query`、`cmd_insights_generate_report`；
- `cmd_memory_search/list/create/update/delete/pin`；
- `cmd_memory_status/rebuild/backfill/clear`；
- `cmd_memory_export`；
- `cmd_artifact_pin/unpin`。

Sidecar Management API：

- `POST /api/memory/recall`；
- `POST /api/memory/turn-completed`；
- `POST /api/memory/upsert`。

Management API 必须继续使用现有 capability token 鉴权，不能另开未鉴权 localhost 端口。

## 8. 必测不变量

1. 重复扫描幂等；
2. 删除来源使派生记忆与产出物失效；
3. user/workspace/agent 作用域不越权；
4. 隐藏 recall 正文不持久化、不显示、不再次抽取；
5. `Asia/Shanghai` 自然日边界正确；
6. `presentation=process` 不计为产出物；
7. Mem0、模型或 Tantivy 故障不影响普通聊天。
