/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Dish {
  id: string;
  name: string;
  description?: string;
  cuisine?: string;
  imageUrl?: string;
  recipe?: string;
  tags?: string[];
  suitableMoments?: string[]; // E.g., ['Ontbijt', 'Warm eten', 'Vieruurtje', Koud eten]
  createdAt: any; // Firestore Timestamp or Date object
  addedBy: string;
}

export interface Rating {
  id: string; // usually ratedBy (family member name)
  score: number; // 1 to 10
  ratedBy: string; // member name
  updatedAt: any; // Firestore Timestamp or Date object
}

export interface Member {
  id: string;
  name: string;
  createdAt: any;
}

export interface PlannedMeal {
  id: string;
  dishId: string;
  plannedDate: string; // YYYY-MM-DD
  mealTime?: string; // 'ontbijt' | 'middag' | 'avond' | 'tussendoor'
  createdAt: any;
}

export type TabValue = 'home' | 'dishes' | 'add' | 'settings' | 'calendar';
