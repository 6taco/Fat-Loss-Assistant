export type ToolName =
  | 'update_weight_goal'
  | 'update_calorie_target'
  | 'generate_meal_plan'
  | 'generate_training_plan'
  | 'reorder_carb_cycle'
  | 'create_shopping_list'
  | 'recommend_fat_loss_strategy'
  | 'activate_fat_loss_strategy'
  | 'adjust_strategy_intensity'
  | 'switch_fat_loss_strategy'
  | 'generate_strategy_day_plans';

export interface ToolCallDraft {
  toolName: ToolName;
  arguments: Record<string, unknown>;
  reason: string;
  confidence: number;
  beforeSnapshot?: Record<string, unknown>;
  afterPreview?: Record<string, unknown>;
}

export interface ToolDefinition {
  name: ToolName;
  version: string;
  description: string;
  riskLevel: 'low' | 'medium';
  requiresConfirmation: boolean;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}
