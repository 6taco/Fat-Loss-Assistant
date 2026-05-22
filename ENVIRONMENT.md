# 环境变量与发布配置

在 `fat-loss-app` 目录创建 `.env.local`：

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/fat_loss_assistant"
DEEPSEEK_API_KEY="your_deepseek_api_key"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
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

## DeepSeek

聊天页调用 `POST /api/chat`，饮食估算调用 `POST /api/nutrition-estimate`。

`DEEPSEEK_API_KEY` 只在服务端读取，不会暴露给客户端。没有 key 或服务异常时：

- 聊天显示本地降级回复。
- 饮食估算允许手动填写碳水、蛋白质、脂肪并保存。

## PWA 发布

PWA 必须通过 HTTPS 验收。推荐 Vercel：

1. 配置环境变量。
2. 执行数据库迁移。
3. 部署后用 Android Chrome 打开线上地址。
4. 在 Dashboard 设置里点击“安装到手机”。
5. 用 Lighthouse 检查 Manifest、Service Worker、Installable、Icons。
