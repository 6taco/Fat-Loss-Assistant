import type { MealLog, MealType } from './mock-data';

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
