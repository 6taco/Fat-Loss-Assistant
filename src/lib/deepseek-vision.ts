type VisionContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface DeepSeekVisionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | VisionContent[];
}

interface DeepSeekVisionChoice {
  message?: {
    content?: string;
  };
}

interface DeepSeekVisionResponse {
  choices?: DeepSeekVisionChoice[];
  error?: {
    message?: string;
  };
}

const DEEPSEEK_VISION_BASE_URL = process.env.DEEPSEEK_VISION_BASE_URL;
const DEEPSEEK_VISION_MODEL = process.env.DEEPSEEK_VISION_MODEL;

export async function askDeepSeekVision(imageDataUrl: string, mealType?: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_VISION_API_KEY || process.env.DEEPSEEK_API_KEY;
  const baseUrl = DEEPSEEK_VISION_BASE_URL || process.env.DEEPSEEK_BASE_URL;
  const model = DEEPSEEK_VISION_MODEL;

  if (!apiKey) throw new Error('Missing DEEPSEEK_VISION_API_KEY');
  if (!baseUrl) throw new Error('Missing DEEPSEEK_VISION_BASE_URL');
  if (!model) throw new Error('Missing DEEPSEEK_VISION_MODEL');

  const messages: DeepSeekVisionMessage[] = [
    {
      role: 'system',
      content: [
        '你是营养估算助手，只返回 JSON，不要 Markdown。',
        '根据餐食照片估算主要食物，并估算碳水、蛋白质、脂肪，单位为克。',
        '输出格式必须是 {"description":"餐食简短描述","items":[{"name":"食物","amountText":"份量","carb":0,"protein":0,"fat":0}],"carb":0,"protein":0,"fat":0}。',
        '不知道精确重量时按常见中国餐食份量估算，数值四舍五入到整数。',
        '如果照片中无法确认食物，也要返回最保守的可见食物估算，不要编造不可见食物。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: `餐次：${mealType || '未指定'}\n请根据这张餐食照片估算三大营养。` },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 900,
      stream: false,
    }),
  });

  const data = (await response.json()) as DeepSeekVisionResponse;

  if (!response.ok) {
    throw new Error(data.error?.message || `DeepSeek vision request failed: ${response.status}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('DeepSeek vision returned empty content');

  return content;
}
