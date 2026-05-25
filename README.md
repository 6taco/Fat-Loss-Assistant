# Fat Loss Assistant

移动端优先的 AI 减脂助手。项目支持用户资料、232 碳循环计划、体重记录、饮食记录、趋势图表、Coach Zero AI 聊天、AI 日报、AI 周报、体重预测和 PWA 安装。

## 核心能力

- Onboarding 采集用户资料并生成训练循环驱动的 232 碳循环计划。
- 饮食记录支持手动填写、文本 AI 估算和 GLM Vision 拍照估算。
- 拍照估算流程：拍照 -> GLM 识别食物和重量 -> DeepSeek 复核营养 -> 用户确认 -> 写入饮食记录。
- 照片只用于当次识别，不保存到 localStorage、数据库或对象存储。
- 报告收件箱集中展示 AI 日报和按个人 7 天周期生成的 AI 周报。
- 趋势页支持线性回归体重预测。

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
DEEPSEEK_MODEL="deepseek-v4-pro"

GLM_API_KEY="your_glm_api_key"
GLM_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
GLM_VISION_MODEL="glm-4v-plus-0111"

CRON_SECRET="your_report_cron_secret"
```

没有数据库或数据库异常时，核心记录会先保存在 localStorage。没有 AI key 时，聊天和饮食 AI 估算会降级为手动流程。

## 数据库

```bash
npx prisma generate
npx prisma migrate dev --name init
```

生产部署：

```bash
npx prisma migrate deploy
```

## 质量检查

提交前运行：

```bash
npx prisma generate
npm run lint
npm run build
```
