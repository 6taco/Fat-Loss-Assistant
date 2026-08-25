# AI Fat Loss Coach

移动端优先的 AI 减脂教练应用。项目支持用户资料、碳循环计划、体重记录、饮食记录、拍照估算、趋势分析、AI 日报、AI 周报、平台期检测、主动教练建议、长期记忆和 PWA 安装。

## 核心能力

- Onboarding 采集用户资料，并生成训练节奏驱动的碳循环计划。
- 饮食记录支持手动填写、文本 AI 估算和 GLM Vision 拍照估算。
- 拍照估算流程：拍照 -> GLM 识别食物和重量 -> DeepSeek 可选复核营养 -> 用户确认 -> 写入饮食记录。
- AI 日报和 AI 周报继续保留，并作为 Coach Feed 的数据来源。
- Coach Feed 主动生成洞察、提醒和待确认建议。
- 平台期检测可生成热量目标调整、碳循环重排、饮食计划、训练计划和采购清单建议。
- 所有会修改计划的 AI 建议都需要用户确认后才生效。
- PWA 支持手机端安装到主屏幕。
- 邮箱密码账号支持验证邮箱、找回密码、多设备 Session、退出当前设备和退出全部设备。
- 旧浏览器 localStorage 数据可以通过 `/import-local` 分块导入云端账号。

## 本地启动

```bash
npm install
npm run dev
```

浏览器打开：

```text
http://localhost:3000
```

手机访问本地开发版时，电脑和手机需要连接同一个 Wi-Fi：

```bash
npm run dev -- -H 0.0.0.0
```

然后手机访问：

```text
http://你的电脑局域网IP:3000
```

## 本地数据库模式

本地开发推荐使用 MySQL 8 或 MariaDB。

创建数据库示例：

```bash
mysql -uroot -p -P3306 -e "CREATE DATABASE IF NOT EXISTS fat_loss_assistant CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

在项目根目录创建或更新 `.env.local`：

```env
DATABASE_URL="mysql://root:123456@localhost:3306/fat_loss_assistant"
```

同步表结构：

```bash
npx prisma db push
npx prisma generate
```

说明：

- 当前仓库缺少最早的 init migration，因此空库初始化建议使用 `npx prisma db push`。
- `npx prisma migrate dev` 适合后续补齐完整 migration 历史后再使用。
- 账号、Session 和个人业务 API 必须配置 `DATABASE_URL`。localStorage 只作为离线缓存和旧数据迁移来源。

## 环境变量

本地 `.env.local` 示例：

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/fat_loss_assistant"

AUTH_SECRET="replace-with-a-long-random-secret"
APP_URL="http://localhost:3000"
# Required only for forgot-password emails.
EMAIL_PROVIDER="smtp"
EMAIL_FROM="轻燃AI <your-qq-number@qq.com>"
SMTP_HOST="smtp.qq.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="your-qq-number@qq.com"
SMTP_PASS="QQ邮箱授权码"
ADMIN_API_KEY="replace-with-a-long-admin-secret"

DEEPSEEK_API_KEY="your_deepseek_api_key"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"

GLM_API_KEY="your_glm_api_key"
GLM_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
GLM_VISION_MODEL="glm-4v-plus-0111"

CRON_SECRET="your_report_cron_secret"
```

注意：

- 不要提交 `.env.local`。
- 不要把 AI key 命名为 `NEXT_PUBLIC_*`，否则会暴露到浏览器端。
- `DEEPSEEK_API_KEY` 和 `GLM_API_KEY` 只应由服务端 API 读取。

## Vercel 部署

手机端安装的是 Vercel 上的 PWA。手机不需要保存数据库、邮件或 AI 密钥，浏览器只调用 Vercel Route Handlers。

在 Vercel 项目中进入：

```text
Project Settings -> Environment Variables
```

需要添加：

```env
DEEPSEEK_API_KEY=你的 DeepSeek key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

GLM_API_KEY=你的 GLM key
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_VISION_MODEL=glm-4v-plus-0111
```

如果线上也要保存用户数据、Coach 记忆、日报周报和建议，还需要配置云数据库：

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/fat_loss_assistant
```

还必须添加：

```env
AUTH_SECRET=至少32字节随机值
APP_URL=https://你的正式域名
EMAIL_PROVIDER=smtp
EMAIL_FROM=轻燃AI <你的QQ邮箱@qq.com>
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=你的QQ邮箱@qq.com
SMTP_PASS=QQ邮箱授权码
CRON_SECRET=随机密钥
ADMIN_API_KEY=随机密钥
```

重要说明：

- Vercel 上的 `localhost` 不是你的电脑，所以不能使用本机 MySQL 的 `localhost:3306` 作为线上数据库。
- 线上需要使用云 MySQL/MariaDB，例如 PlanetScale、Aiven、Railway、TiDB Cloud 等。
- Production 与 Preview 应使用不同的 `AUTH_SECRET` 和数据库。
- Aiven 连接必须启用 SSL；如使用 CA，配置 `DATABASE_CA_CERT`。

## AI 服务

- `POST /api/chat` 使用 DeepSeek 进行教练聊天。
- `POST /api/nutrition-estimate` 使用 DeepSeek 进行文本饮食估算。
- `POST /api/nutrition-estimate/photo` 使用 GLM Vision 识别图片，并可用 DeepSeek 做营养复核。
- `POST /api/coach/run-daily` 生成每日教练复盘、洞察、提醒和建议。
- `POST /api/coach/run-weekly` 生成每周教练策略、平台期判断和下周建议。
- `GET /api/coach/feed` 获取主动教练动态。

照片隐私说明：

- 照片只用于当次识别请求。
- 照片不会保存到 localStorage、数据库或对象存储。
- 前端会在上传前压缩图片。

## 常用命令

```bash
npx prisma generate
npm run lint
npm run build
```

本地数据库同步：

```bash
npx prisma db push
```

生产部署如果已有可回放 migration 历史，可使用：

```bash
npx prisma migrate deploy
```

## 数据同步说明

- 浏览器 localStorage 仅作为离线缓存和旧数据迁移来源，不保存登录凭证。
- 登录身份只来自数据库 Session 和 HttpOnly Cookie。
- 个人业务 API 数据库写入失败时会明确报错，不会返回伪造的本地成功响应。
- 本地旧账户数据通过 `/import-local` 选择来源账户后分块导入，重复导入由服务端幂等映射去重。


查看数据埋点：http://localhost:3000/analytics
