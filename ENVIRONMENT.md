# 环境变量与发布配置

在 `fat-loss-app` 目录创建 `.env.local`：

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/fat_loss_assistant"

DEEPSEEK_API_KEY="your_deepseek_api_key"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-v4-pro"

GLM_API_KEY="your_glm_api_key"
GLM_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
GLM_VISION_MODEL="glm-4v-plus-0111"

CRON_SECRET="your_report_cron_secret"
```

不要提交 `.env.local`。

## Prisma 7 + MySQL

项目使用 Prisma 7 的 MariaDB/MySQL driver adapter：

- `@prisma/adapter-mariadb`
- `mariadb`

`DATABASE_URL` 必须是 MySQL/MariaDB 连接字符串。API 路由会在请求时懒加载 Prisma Client；没有 `DATABASE_URL` 或数据库不可用时，前端 store 会继续使用 localStorage 兜底。

本地初始化：

```bash
npx prisma generate
npx prisma migrate dev --name init
```

生产部署：

```bash
npx prisma migrate deploy
```

## AI 服务

- 聊天页调用 `POST /api/chat`，使用 DeepSeek。
- 文本饮食估算调用 `POST /api/nutrition-estimate`，使用 DeepSeek。
- 拍照估算调用 `POST /api/nutrition-estimate/photo`，使用 GLM Vision 识别图片，并用 DeepSeek 做可选营养复核。
- AI 每日复盘使用 `GET /api/cron/daily-reports` 在北京时间 24:00 生成上一日收盘日报。
- AI 每周复盘使用 `GET /api/cron/weekly-reports` 每天北京时间 00:20 扫描并生成刚结束的个人 7 天周期周报。

`DEEPSEEK_API_KEY` 和 `GLM_API_KEY` 只在服务端读取，不会暴露给客户端。

拍照估算说明：

- 照片只用于本次识别请求。
- 照片不会保存到 localStorage、数据库或对象存储。
- 前端会把图片压缩到最长边 1280px 后上传。
- DeepSeek 复核失败不会阻断保存，页面会展示 GLM 原始估算结果供用户确认。

## Cron

`CRON_SECRET` 用于保护定时任务接口。推荐请求头：

```http
Authorization: Bearer your_report_cron_secret
```

Vercel Cron 配置在 `vercel.json`。

## PWA 发布

PWA 必须通过 HTTPS 验收。推荐部署到 Vercel：

1. 配置环境变量。
2. 执行数据库迁移。
3. 部署后用 Android Chrome 打开线上地址。
4. 在 Dashboard 设置里点击“安装到手机”。
5. 用 Lighthouse 检查 Manifest、Service Worker、Installable 和 Icons。
