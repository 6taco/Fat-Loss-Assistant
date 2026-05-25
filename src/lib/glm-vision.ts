type VisionContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface GLMMessage {
  role: 'system' | 'user';
  content: string | VisionContent[];
}

interface GLMResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

const GLM_BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
const GLM_VISION_MODEL = process.env.GLM_VISION_MODEL || 'glm-4v-plus-0111';

const GLM_VISION_SYSTEM_PROMPT = `你是 Fat Loss Assistant 的餐食拍照估算助手。
请根据图片识别可见食物，并估算每项食物重量、热量、蛋白质、脂肪、碳水。

支持场景：
中餐、西餐、轻食、奶茶、零食。

规则：
1. 只基于图片中可见内容，不要虚构不可见食物。
2. 份量不确定时，按常见一人份保守估算。
3. 中餐混合菜要拆成主食、肉类、蔬菜、油脂/酱料。
4. 奶茶要估算容量、糖量、小料、奶盖。
5. 零食按可见包装或可见份量估算。
6. 输出 JSON，不要 Markdown。

JSON 格式：
{
  "description": "餐食摘要",
  "items": [
    {
      "name": "食物名称",
      "amountText": "约1碗/约120g",
      "weightGram": 120,
      "calories": 180,
      "protein": 12,
      "fat": 6,
      "carb": 18,
      "confidence": 0.75
    }
  ],
  "totals": {
    "calories": 520,
    "protein": 35,
    "fat": 18,
    "carb": 58
  },
  "confidence": 0.75,
  "warnings": ["图片无法判断具体用油量，已按常见份量估算"]
}`;

export async function askGLMFoodVision(imageDataUrl: string, mealType?: string): Promise<string> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) throw new Error('Missing GLM_API_KEY');

  const messages: GLMMessage[] = [
    {
      role: 'system',
      content: GLM_VISION_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `餐次：${mealType || '未指定'}\n请根据这张餐食照片识别食物、估算重量和营养数据。`,
        },
        {
          type: 'image_url',
          image_url: { url: imageDataUrl },
        },
      ],
    },
  ];

  const response = await fetch(`${GLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GLM_VISION_MODEL,
      messages,
      temperature: 0.1,
      max_tokens: 1200,
      stream: false,
    }),
  });

  const data = (await response.json()) as GLMResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `GLM vision request failed: ${response.status}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('GLM vision returned empty content');
  return content;
}

export function getGLMVisionModel() {
  return GLM_VISION_MODEL;
}
