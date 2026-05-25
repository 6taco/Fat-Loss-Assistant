import { NextRequest, NextResponse } from 'next/server';
import { askDeepSeekVision } from '@/lib/deepseek-vision';
import { parseNutritionEstimate } from '@/lib/nutrition-estimate';

interface PhotoEstimateBody {
  imageDataUrl?: string;
  mealType?: string;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PhotoEstimateBody;
    const imageDataUrl = body.imageDataUrl?.trim();

    if (!imageDataUrl) {
      return NextResponse.json({ error: 'imageDataUrl is required' }, { status: 400 });
    }

    if (!isSupportedImageDataUrl(imageDataUrl)) {
      return NextResponse.json({ error: 'imageDataUrl must be a base64 image data URL' }, { status: 400 });
    }

    if (estimateDataUrlBytes(imageDataUrl) > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'image size must be 5MB or less' }, { status: 413 });
    }

    const content = await askDeepSeekVision(imageDataUrl, body.mealType);
    const parsed = parseNutritionEstimate(content);

    return NextResponse.json({ estimate: parsed, source: 'ai' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), source: 'manual' }, { status: 502 });
  }
}

function isSupportedImageDataUrl(value: string) {
  return /^data:image\/(png|jpe?g|webp|heic|heif);base64,[A-Za-z0-9+/=]+$/i.test(value);
}

function estimateDataUrlBytes(value: string) {
  const base64 = value.split(',')[1] || '';
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Photo nutrition estimate failed';
}
