import { type ToolDefinition, type ToolName } from '@/lib/mcp/types';

export const toolRegistry: Record<ToolName, ToolDefinition> = {
  update_weight_goal: {
    name: 'update_weight_goal',
    version: '1.0.0',
    description: '调整用户减脂目标体重',
    riskLevel: 'medium',
    requiresConfirmation: true,
    inputSchema: { userId: 'string', goalWeight: 'number', reason: 'string?' },
    outputSchema: { success: 'boolean' },
  },
  update_calorie_target: {
    name: 'update_calorie_target',
    version: '1.0.0',
    description: '调整未来热量目标',
    riskLevel: 'medium',
    requiresConfirmation: true,
    inputSchema: { userId: 'string', startDate: 'string', days: 'number', calorieDelta: 'number' },
    outputSchema: { success: 'boolean' },
  },
  generate_meal_plan: {
    name: 'generate_meal_plan',
    version: '1.0.0',
    description: '生成未来饮食计划',
    riskLevel: 'low',
    requiresConfirmation: true,
    inputSchema: { userId: 'string', startDate: 'string', days: 'number' },
    outputSchema: { success: 'boolean' },
  },
  generate_training_plan: {
    name: 'generate_training_plan',
    version: '1.0.0',
    description: '生成未来训练计划',
    riskLevel: 'low',
    requiresConfirmation: true,
    inputSchema: { userId: 'string', startDate: 'string', days: 'number' },
    outputSchema: { success: 'boolean' },
  },
  reorder_carb_cycle: {
    name: 'reorder_carb_cycle',
    version: '1.0.0',
    description: '重排碳循环日程',
    riskLevel: 'medium',
    requiresConfirmation: true,
    inputSchema: { userId: 'string', startDate: 'string', days: 'number' },
    outputSchema: { success: 'boolean' },
  },
  create_shopping_list: {
    name: 'create_shopping_list',
    version: '1.0.0',
    description: '生成采购清单',
    riskLevel: 'low',
    requiresConfirmation: true,
    inputSchema: { userId: 'string', startDate: 'string', days: 'number' },
    outputSchema: { success: 'boolean' },
  },
};

export function listTools() {
  return Object.values(toolRegistry).map(tool => ({
    name: tool.name,
    version: tool.version,
    description: tool.description,
    riskLevel: tool.riskLevel,
    requiresConfirmation: tool.requiresConfirmation,
  }));
}
