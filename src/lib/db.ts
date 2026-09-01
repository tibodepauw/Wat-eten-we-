/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Dish, Rating, Member, PlannedMeal, ShoppingItem } from '../types';

const fetchJSON = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    let errorMsg = `HTTP error: ${response.status}`;
    try {
      const errData = await response.json();
      if (errData && errData.error) {
        errorMsg = errData.error;
      }
    } catch {
      // Ignore json parse error on non-json response
    }
    throw new Error(errorMsg);
  }
  return response.json();
};

export const isFirestoreFallback = true;
export const db = null;

// Unified Central Sync Engine
type Listener<T> = (data: T) => void;

class SyncEngine {
  private memberListeners = new Set<Listener<Member[]>>();
  private dishesListeners = new Set<Listener<Dish[]>>();
  private ratingsListeners = new Set<Listener<{ [dishId: string]: Rating[] }>>();
  private plannedListeners = new Set<Listener<PlannedMeal[]>>();
  private shoppingListeners = new Set<Listener<ShoppingItem[]>>();

  private lastMembersJSON = '';
  private lastDishesJSON = '';
  private lastRatingsJSON = '';
  private lastPlannedJSON = '';
  private lastShoppingJSON = '';

  private pollIntervalHandle: any = null;
  private isPolling = false;

  private startPollingIfNeeded() {
    if (this.pollIntervalHandle) return;
    this.pollSync();
    this.pollIntervalHandle = setInterval(() => this.pollSync(), 2500);
  }

  private stopPollingIfEmpty() {
    const total =
      this.memberListeners.size +
      this.dishesListeners.size +
      this.ratingsListeners.size +
      this.plannedListeners.size +
      this.shoppingListeners.size;
    if (total === 0 && this.pollIntervalHandle) {
      clearInterval(this.pollIntervalHandle);
      this.pollIntervalHandle = null;
    }
  }

  public async pollSync() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const syncData = await fetchJSON('/api/sync');

      // Dispatch Members
      if (syncData.members) {
        const serialized = JSON.stringify(syncData.members);
        if (serialized !== this.lastMembersJSON) {
          this.lastMembersJSON = serialized;
          const parsedMembers = syncData.members.map((m: any) => ({
            ...m,
            createdAt: new Date(m.createdAt)
          }));
          this.memberListeners.forEach(cb => cb(parsedMembers));
        }
      }

      // Dispatch Dishes
      if (syncData.dishes) {
        const serialized = JSON.stringify(syncData.dishes);
        if (serialized !== this.lastDishesJSON) {
          this.lastDishesJSON = serialized;
          const parsedDishes = syncData.dishes.map((d: any) => ({
            ...d,
            createdAt: new Date(d.createdAt)
          }));
          this.dishesListeners.forEach(cb => cb(parsedDishes));
        }
      }

      // Dispatch Ratings
      if (syncData.ratings) {
        const serialized = JSON.stringify(syncData.ratings);
        if (serialized !== this.lastRatingsJSON) {
          this.lastRatingsJSON = serialized;
          const map: { [dishId: string]: Rating[] } = {};
          Object.keys(syncData.ratings).forEach(dishId => {
            map[dishId] = syncData.ratings[dishId].map((r: any) => ({
              ...r,
              updatedAt: new Date(r.updatedAt)
            }));
          });
          this.ratingsListeners.forEach(cb => cb(map));
        }
      }

      // Dispatch Planned Meals
      if (syncData.planned_meals) {
        const serialized = JSON.stringify(syncData.planned_meals);
        if (serialized !== this.lastPlannedJSON) {
          this.lastPlannedJSON = serialized;
          const parsedPlanned = syncData.planned_meals.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt)
          }));
          this.plannedListeners.forEach(cb => cb(parsedPlanned));
        }
      }

      // Dispatch Shopping List
      if (syncData.shopping_list) {
        const serialized = JSON.stringify(syncData.shopping_list);
        if (serialized !== this.lastShoppingJSON) {
          this.lastShoppingJSON = serialized;
          const parsedShopping = syncData.shopping_list.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt)
          }));
          this.shoppingListeners.forEach(cb => cb(parsedShopping));
        }
      }
    } catch (error) {
      console.warn('Sync engine polling error:', error);
    } finally {
      this.isPolling = false;
    }
  }

  public subscribeMembers(callback: Listener<Member[]>) {
    this.memberListeners.add(callback);
    this.startPollingIfNeeded();
    return () => {
      this.memberListeners.delete(callback);
      this.stopPollingIfEmpty();
    };
  }

  public subscribeDishes(callback: Listener<Dish[]>) {
    this.dishesListeners.add(callback);
    this.startPollingIfNeeded();
    return () => {
      this.dishesListeners.delete(callback);
      this.stopPollingIfEmpty();
    };
  }

  public subscribeRatings(callback: Listener<{ [dishId: string]: Rating[] }>) {
    this.ratingsListeners.add(callback);
    this.startPollingIfNeeded();
    return () => {
      this.ratingsListeners.delete(callback);
      this.stopPollingIfEmpty();
    };
  }

  public subscribePlannedMeals(callback: Listener<PlannedMeal[]>) {
    this.plannedListeners.add(callback);
    this.startPollingIfNeeded();
    return () => {
      this.plannedListeners.delete(callback);
      this.stopPollingIfEmpty();
    };
  }

  public subscribeShoppingList(callback: Listener<ShoppingItem[]>) {
    this.shoppingListeners.add(callback);
    this.startPollingIfNeeded();
    return () => {
      this.shoppingListeners.delete(callback);
      this.stopPollingIfEmpty();
    };
  }
}

const syncEngine = new SyncEngine();

export const MealDatabase = {
  // Members real-time subscriptions
  subscribeMembers(callback: (members: Member[]) => void) {
    return syncEngine.subscribeMembers(callback);
  },

  async addMember(name: string, password?: string, avatarColor?: string, avatarLetter?: string, avatarIcon?: string): Promise<any> {
    const data = await fetchJSON('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password, avatarColor, avatarLetter, avatarIcon })
    });
    syncEngine.pollSync();
    return data;
  },

  async loginMember(name: string, password?: string): Promise<any> {
    const resp = await fetchJSON('/api/members/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password })
    });
    return resp; // returns { success: true, member }
  },

  async updateMember(memberId: string, updates: Partial<Member>): Promise<any> {
    const resp = await fetchJSON(`/api/members/${memberId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    syncEngine.pollSync();
    return resp;
  },

  async deleteMember(memberId: string): Promise<void> {
    await fetchJSON(`/api/members/${memberId}`, {
      method: 'DELETE'
    });
    syncEngine.pollSync();
  },

  // Dishes real-time subscriptions
  subscribeDishes(callback: (dishes: Dish[]) => void) {
    return syncEngine.subscribeDishes(callback);
  },

  async addDish(dish: Omit<Dish, 'id' | 'createdAt'>): Promise<string> {
    const savedDish = await fetchJSON('/api/dishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dish)
    });
    syncEngine.pollSync();
    return savedDish.id;
  },

  async updateDish(dishId: string, updates: Partial<Omit<Dish, 'id' | 'createdAt'>>): Promise<void> {
    await fetchJSON(`/api/dishes/${dishId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    syncEngine.pollSync();
  },

  async deleteDish(dishId: string): Promise<void> {
    await fetchJSON(`/api/dishes/${dishId}`, { method: 'DELETE' });
    syncEngine.pollSync();
  },

  // Ratings real-time subscriptions
  subscribeAllRatings(callback: (ratings: { [dishId: string]: Rating[] }) => void) {
    return syncEngine.subscribeRatings(callback);
  },

  async rateDish(dishId: string, memberName: string, score: number): Promise<void> {
    await fetchJSON('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dishId, memberName, score })
    });
    syncEngine.pollSync();
  },

  // Planned meals real-time subscriptions
  subscribePlannedMeals(callback: (planned: PlannedMeal[]) => void) {
    return syncEngine.subscribePlannedMeals(callback);
  },

  async addPlannedMeal(planned: Omit<PlannedMeal, 'id' | 'createdAt'>): Promise<string> {
    const savedMeal = await fetchJSON('/api/planned_meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planned)
    });
    syncEngine.pollSync();
    return savedMeal.id;
  },

  async deletePlannedMeal(id: string): Promise<void> {
    await fetchJSON(`/api/planned_meals/${id}`, { method: 'DELETE' });
    syncEngine.pollSync();
  },

  // Shopping List real-time subscriptions
  subscribeShoppingList(callback: (items: ShoppingItem[]) => void) {
    return syncEngine.subscribeShoppingList(callback);
  },

  async addShoppingItems(items: any | any[]): Promise<void> {
    await fetchJSON('/api/shopping_list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items)
    });
    syncEngine.pollSync();
  },

  async updateShoppingItem(id: string, updates: any): Promise<void> {
    await fetchJSON(`/api/shopping_list/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    syncEngine.pollSync();
  },

  async deleteShoppingItem(id: string): Promise<void> {
    await fetchJSON(`/api/shopping_list/${id}`, { method: 'DELETE' });
    syncEngine.pollSync();
  },

  async clearShoppingList(type: 'completed' | 'all'): Promise<void> {
    await fetchJSON('/api/shopping_list/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    syncEngine.pollSync();
  }
};
