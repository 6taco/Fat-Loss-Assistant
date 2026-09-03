import type { MealLog, MealType } from './types';

export interface MealGroup {
  mealType: MealType;
  meals: MealLog[];
  summary: {
    carb: number;
    protein: number;
    fat: number;
    calories: number;
  };
}

export const orderedMealTypes: MealType[];

export function groupMealsByType(meals: MealLog[]): MealGroup[];
