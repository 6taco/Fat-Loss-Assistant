# 减脂助手 Fat Loss Assistant

移动端优先的减脂 MVP：Onboarding 采集用户资料，生成 232 碳循环计划，支持体重记录、饮食记录、趋势查看、日历打卡和 Coach Zero AI 问答。

## 数据策略

当前版本采用“本地优先 + 匿名云同步”：

- 用户资料：`fla_user`
- 匿名用户 ID：`fla_anonymous_user_id`
- 碳循环计划：`fla_plan`
- 体重记录：`fla_weight`
- 饮食记录：`fla_meals`
- 聊天记录：`fla_chat`

前端会先写入 localStorage，数据库可用时再同步 API。没有数据库或数据库异常时，API 会返回 `source: "local"`，核心记录和查看流程不被阻断。

## 本地启动

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。

## 环境变量

在项目根目录创建 `.env.local`：

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/fat_loss_assistant"
DEEPSEEK_API_KEY="your_deepseek_api_key"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
```

初始化数据库：

```bash
npx prisma generate
npx prisma migrate dev --name init
```

生产部署使用：

```bash
npx prisma migrate deploy
```

没有 `DEEPSEEK_API_KEY` 时，聊天和饮食 AI 估算会降级，不影响手动记录。

## PWA 安装发布

项目已包含 Android PWA 安装能力：

- `public/manifest.webmanifest`
- `public/sw.js`
- `public/offline.html`
- `public/icons/*`
- Dashboard 设置弹窗中的“安装到手机”入口

推荐部署到 Vercel 或其他 HTTPS 环境。Android Chrome 访问 HTTPS 地址后，可通过页面内安装按钮或浏览器菜单“添加到主屏幕”安装。

## Android 验收

1. Chrome 访问线上 HTTPS 地址。
2. 打开 Dashboard 右上角设置，点击“安装到手机”。
3. 从主屏幕启动，确认独立窗口打开且无浏览器地址栏。
4. 完成 Onboarding，确认生成碳循环计划。
5. 记录体重，刷新后确认数据不丢失，Trends 显示初始体重和新体重。
6. 记录饮食，确认今日摄入能对比今日目标。
7. 测试有/无 `DEEPSEEK_API_KEY` 的 AI 聊天和饮食估算。
8. 模拟数据库不可用，确认页面无 503 干扰，本地数据仍可用。
9. 断网后重新打开，确认出现离线兜底页或已缓存页面。

## 质量检查

每次提交前运行：

```bash
npx prisma generate
npm run lint
npm run build
```
