# AI Fat Loss Coach 产品梳理文档

## 1. 项目一句话定位

AI Fat Loss Coach 是一个面向个人减脂用户的 AI 健康教练产品。

它不只是记录体重、饮食和计划，而是围绕用户长期数据，主动生成复盘、趋势判断、平台期解释、计划建议、知识库问答和数字减脂分身，目标是从“减脂记录工具”升级为“Personal AI Health Coach”。

## 2. 当前产品形态

当前产品是一个 Next.js + React PWA 应用，支持电脑端和手机端访问安装。

核心导航包括：

- 首页 / Today：查看今日计划、记录状态、目标宏量。
- 教练 / Coach：查看 AI 主动建议、日报、周报、Action Proposal。
- 聊天 / Chat：和 Coach Zero 对话，支持 RAG 知识库和连续追问。
- 分身 / Digital Twin：查看数字减脂分身、未来体重预测和情景模拟。
- 计划 / Plan：查看碳循环、饮食计划、训练计划、采购清单。
- 饮食 / Meals：记录饮食、上传照片估算营养。
- 日历 / Calendar：查看计划日历。
- 趋势 / Progress：查看体重趋势、预测和复盘。
- 账号 / Onboarding：创建账号、填写基础信息、生成初始计划。
- 分析 / Analytics：自建埋点分析面板。

## 3. 已实现的核心功能

### 3.1 用户与本地模式

已实现：

- 多账号本地管理。
- Onboarding 基础资料填写。
- 训练频率、体型、体脂、体重信息录入。
- 本地数据存储。
- 本地数据同步到 MySQL。
- PWA 场景下手机端访问和安装。

产品价值：

- 用户可以先本地使用，不完全依赖服务器。
- 数据可同步到数据库，供 AI、RAG、Agent、Digital Twin 使用。

### 3.2 碳循环计划

已实现：

- 基于用户体重、体型、训练频率生成 28 天碳循环计划。
- 高碳、中碳、低碳日分配。
- 根据训练部位匹配高碳日。
- 每日热量、碳水、蛋白、脂肪目标。
- DayPlan 数据库存储。
- 完成打卡。

产品价值：

- 用户不是只拿到一个固定热量目标，而是有训练日匹配的周期计划。

### 3.3 体重记录与趋势预测

已实现：

- 体重记录。
- 体重数据同步到数据库。
- 体重预测接口。
- 线性趋势预测。
- 平台期检测基础能力。
- Progress / Trends 页面查看趋势。

产品价值：

- 避免用户被单日体重波动误导。
- 支持 AI 基于 7 / 14 / 30 天趋势做解释。

### 3.4 饮食记录与图片识别

已实现：

- 手动记录饮食。
- 餐食宏量营养记录：热量、碳水、蛋白、脂肪。
- GLM Vision 图片识别估算营养。
- MealLog 数据库存储。
- 饮食数据参与日报、周报、Agent 分析和 Digital Twin。

产品价值：

- 降低饮食记录成本。
- 支持后续分析蛋白达标率、热量执行率、饮食模式。

### 3.5 AI 日报与周报

已实现：

- Daily Report 生成。
- Weekly Report 生成。
- Report Inbox / Coach Feed 展示。
- 日报、周报可读状态。
- Cron 路由预留。
- 报告数据进入 Coach Feed 和长期分析。

产品价值：

- 用户不需要每天主动问 AI，系统可以主动复盘。
- 每周能看到趋势、执行率、风险和下周建议。

### 3.6 Coach Feed 主动教练流

已实现：

- Coach 页面。
- CoachInsight。
- ActionProposal。
- NotificationEvent 数据结构。
- 未处理建议卡。
- Chat 入口保留，但从主体验上转为辅助问答。

产品价值：

- 从“用户问 AI”转为“AI 主动发现问题”。
- 所有计划变更默认需要用户确认。

### 3.7 RAG 知识库问答

已实现：

- KnowledgeSource。
- KnowledgeChunk。
- RagQueryLog。
- Markdown / plain text 导入接口。
- GLM embedding。
- MySQL JSON 存 embedding。
- Node.js cosine similarity 检索。
- 本地 rerank。
- DeepSeek 基于证据生成回答。
- `/api/rag/ingest`
- `/api/rag/search`
- `/api/rag/answer`
- `/api/rag/sources`
- `/api/rag/reindex`
- `/api/chat` 优先接入 RAG。

当前优化：

- RAG 查询仍然优先。
- GLM embedding 加缓存。
- 知识库 chunk 加缓存。
- embedding 设置短超时，超时后关键词检索兜底。
- 默认关闭 DeepSeek rerank，使用本地重排加速。
- 减少候选数量和 prompt 证据长度。
- 支持连续追问，将上一轮问题拼回检索问题。

产品价值：

- AI 回答减脂问题时优先基于知识库，而不是纯靠大模型常识。
- 回答可带引用来源。
- 对“低碳日失眠为什么”“平台期怎么办”等问题能结合专业资料回答。

### 3.8 AI 聊天

已实现：

- Chat 页面。
- Coach Zero 角色。
- 历史消息本地保存。
- 消息同步到数据库。
- 支持 RAG 回答。
- 支持 Tool Proposal。
- 支持 Multi-Agent 分析。
- 支持 DeepSeek 普通聊天兜底。
- 支持连续追问上下文改写。

当前行为：

- 知识型问题优先 RAG。
- 明确执行类请求进入 Tool Calling。
- 数据分析类问题可进入 Agent Workflow。
- 普通情绪支持或一般聊天走 DeepSeek。
- 所有链路失败时都有 fallback，不应再裸 500。

产品价值：

- 用户可以连续追问，而不是每句都当成独立问题。
- 聊天既能回答问题，也能触发待确认动作。

### 3.9 MCP + Tool Calling

已实现：

- MCP Tool Registry。
- Tool schema。
- Tool policy。
- Tool executor。
- ToolInvocationLog。
- ToolExecutionLog。
- ToolExecutionSnapshot。
- ActionProposal 确认层。

已注册工具：

- `update_weight_goal`
- `update_calorie_target`
- `generate_meal_plan`
- `generate_training_plan`
- `reorder_carb_cycle`
- `create_shopping_list`

当前原则：

- LLM 不直接写库。
- LLM 只能生成 tool call proposal。
- 用户确认后才执行。
- 执行前做安全校验。
- 执行过程记录日志。

产品价值：

- AI 从“只会说”升级为“能提出可执行动作”。
- 但仍然保留用户确认，避免高风险自动修改。

### 3.10 多 Agent 协同架构

已实现 Agent 服务层：

- `Nutrition Agent`
- `Training Agent`
- `Recovery Agent`
- `Strategy Agent`
- `Coach Agent`
- `Coach Orchestrator`
- `Agent Context Builder`
- `Agent Memory`

已实现数据结构：

- AgentRun
- AgentMessage
- AgentFinding
- AgentMemory

工作方式：

- Orchestrator 收集用户、计划、饮食、体重、报告、记忆等上下文。
- Nutrition / Training / Recovery 进行领域分析。
- Strategy 汇总长期策略和 proposal 草案。
- Coach Agent 负责最终中文表达。
- 所有修改类动作继续走 ActionProposal。

产品价值：

- 不再让一个大模型同时做所有事。
- 饮食、训练、恢复、策略、表达分工更清晰。
- 为后续精细化建议和长期记忆打基础。

## 4. Agent 职责说明

### 4.1 Nutrition Agent

负责：

- 饮食记录分析。
- 热量执行情况。
- 蛋白达标率。
- 碳水 / 脂肪分布。
- 餐食记录完整度。
- 饮食风险模式，例如蛋白不足、周末超标。

不负责：

- 不直接修改热量目标。
- 不直接生成最终用户话术。

### 4.2 Training Agent

负责：

- 训练频率分析。
- 训练日与碳循环匹配。
- 高碳日是否匹配腿 / 背 / 高强度训练。
- 训练安排风险。
- 训练计划建议。

不负责：

- 不直接修改 DayPlan。
- 不做康复或医疗诊断。

### 4.3 Recovery Agent

负责：

- 睡眠、疲劳、压力、恢复分析。
- 数据不足时低置信度输出。
- 判断是否可能因为恢复不足导致体重波动。
- 给 Strategy Agent 提供是否暂缓降热量的信号。

当前限制：

- 真实睡眠和步数数据还不足，MVP 主要基于训练连续性、体重波动、记录完整度推断。

### 4.4 Strategy Agent

负责：

- 汇总 Nutrition / Training / Recovery 的发现。
- 判断长期减脂策略。
- 判断平台期风险。
- 决定是否生成 ActionProposal 草案。
- 决定建议优先级。

可提出：

- 热量调整建议。
- 碳循环重排建议。
- 餐单生成建议。
- 训练计划生成建议。
- 采购清单建议。

不负责：

- 不直接写库。
- 不绕过确认层。

### 4.5 Coach Agent

负责：

- 最终用户表达。
- 中文、温和、具体、移动端可读的回复。
- 日报、周报、Coach Feed 卡片话术。
- 解释“为什么建议”和“确认后才执行”。

不负责：

- 不做底层策略决策。
- 不直接执行工具。

## 5. Digital Twin 数字减脂分身

已实现：

- DigitalTwinProfile。
- DigitalTwinFeatureSnapshot。
- DigitalTwinPrediction。
- DigitalTwinScenario。
- `/digital-twin` 页面。
- `/api/digital-twin`
- `/api/digital-twin/generate`
- `/api/digital-twin/simulate`
- `/api/digital-twin/scenarios`

能力：

- 用户画像生成。
- 行为习惯分析。
- 饮食画像分析。
- 体重趋势建模。
- 平台期风险预测。
- 未来 30 天体重预测。
- 情景模拟。

已支持情景：

- 保持当前饮食。
- 每天多 5000 步。
- 每天少 100 kcal。
- 每周多打卡 2 天。

产品价值：

- 让用户看到“如果继续这样，未来可能怎样”。
- 从记录工具升级为个性化减脂模型。
- 支持后续 Strategy Agent 引用数字分身做长期建议。

## 6. 数据埋点与产品分析

已实现：

- Analytics SDK。
- Analytics collector API。
- AnalyticsEvent。
- AnalyticsIdentity。
- AnalyticsSession。
- AnalyticsDailyAggregate。
- AnalyticsUserLifecycle。
- `/analytics` 页面。
- Analytics summary API。

覆盖事件包括：

- app_open
- session_start / session_end
- sign_up
- onboarding_start / onboarding_complete
- plan_generate
- weight_log_create
- meal_log_create
- photo_upload
- daily_report_view
- weekly_report_view
- ai_chat_send / ai_chat_reply
- coach_feed_view / coach_feed_click
- proposal_view / proposal_accept / proposal_dismiss / proposal_edit

重点指标：

- 次日留存。
- 7 日留存。
- 打卡率。
- AI 功能使用率。
- 建议采纳率。
- Coach Feed 点击率。

产品价值：

- 可以从产品视角判断用户是否被激活。
- 可以衡量 AI Coach 是否真的提高留存和执行。

## 7. 当前系统架构

```text
用户记录 / 上传 / 聊天 / 打开 App
        |
        v
Next.js API
        |
        +-- 数据记录：User / DayPlan / WeightEntry / MealLog
        |
        +-- AI 日报周报：DailyReport / WeeklyReport
        |
        +-- Coach Feed：CoachInsight / ActionProposal
        |
        +-- RAG：KnowledgeSource / KnowledgeChunk / GLM embedding / DeepSeek answer
        |
        +-- MCP Tool Calling：Tool Registry / Proposal / Executor
        |
        +-- Multi-Agent：Nutrition / Training / Recovery / Strategy / Coach
        |
        +-- Digital Twin：Profile / Features / Prediction / Scenario
        |
        +-- Analytics：Event / Session / Lifecycle / Dashboard
        |
        v
Prisma + MySQL
```

## 8. 已接入的 AI 能力

### DeepSeek

用途：

- 普通 AI 聊天。
- RAG 最终回答。
- RAG 可选 rerank。
- Agent 解释和表达。
- 日报、周报、Coach 话术。

### GLM

用途：

- GLM Vision 图片识别饮食。
- GLM Embedding 生成知识库向量。

当前约束：

- 不引入 OpenAI、Cohere、Qdrant 等新外部模型或服务。
- RAG MVP 使用 MySQL-only vector store。

## 9. 当前已落地与仍是 MVP 的边界

### 已经落地

- 基础记录系统。
- 碳循环计划。
- 体重趋势。
- AI 日报和周报。
- Coach Feed。
- RAG 知识库。
- AI 聊天 RAG 优先。
- Tool Calling 提案机制。
- 多 Agent 服务层。
- Digital Twin 页面和预测。
- Analytics 埋点系统。
- MySQL 本地数据库模式。

### 仍属于 MVP / 待增强

- RAG 知识库内容需要继续补充权威资料。
- RAG 目前是 MySQL JSON embedding，不是专业向量数据库。
- Recovery Agent 缺少真实睡眠、步数数据。
- Tool Calling 的编辑确认 UI 还可以继续加强。
- Digital Twin 目前是规则模型，不是机器学习模型。
- Agent Memory 管理页面还可继续完善。
- 商业化和权限分层尚未完整落地。
- 线上 Netlify 环境需要配置数据库和 API key，才能和本地能力一致。

## 10. 推荐的产品下一步

### 优先级 P0

1. 修复全局中文乱码。
2. 完善 RAG 知识库导入内容。
3. 优化 Chat 连续对话体验。
4. 打磨 ActionProposal 确认卡片。
5. 确认手机端 PWA 数据同步链路。

### 优先级 P1

1. Coach Feed 卡片分层：日报、周报、平台期、建议、提醒。
2. Digital Twin 与 Strategy Agent 深度集成。
3. Profile 页面增加 AI 记忆管理。
4. Analytics Dashboard 增加留存和建议采纳漏斗。
5. 增加通知设置和每日主动提醒。

### 优先级 P2

1. 订阅商业化。
2. PDF / 海报导出。
3. 更完善的训练计划周期化。
4. 步数、睡眠、恢复数据接入。
5. 独立向量数据库升级。

## 11. 给产品经理的快速理解

这个项目现在已经不是一个简单减脂记录 App，而是一个包含以下能力的 AI Coach 产品雏形：

- 记录：体重、饮食、训练、计划完成。
- 分析：日报、周报、趋势、平台期。
- 知识：RAG 权威知识库问答。
- 行动：Tool Calling 生成待确认动作。
- 协作：多 Agent 分工分析。
- 个性化：Digital Twin 建立用户长期模型。
- 增长分析：自建埋点和 Dashboard。

产品核心差异点是：

1. 用户不需要每天主动问，Coach 可以主动复盘。
2. AI 不直接乱改计划，所有修改都要用户确认。
3. 问答优先基于知识库，而不是纯大模型发挥。
4. 长期方向是建立用户自己的数字减脂分身。

