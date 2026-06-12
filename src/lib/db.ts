/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Dish, Rating, Member, PlannedMeal } from '../types';

// Let's create a robust helper to check if we can reach the backend.
// In our full-stack container, the backend will always be running.
const fetchJSON = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const isFirestoreFallback = true;
export const db = null;

// Clean standalone state sync engine with ultra-optimized active polling for real-time multiplayer feel!
export const MealDatabase = {
  // Members real-time subscriptions
  subscribeMembers(callback: (members: Member[]) => void) {
    let active = true;
    let lastJSON = '';

    const poll = async () => {
      try {
        const data = await fetchJSON('/api/members');
        if (!active) return;
        const serialized = JSON.stringify(data);
        if (serialized !== lastJSON) {
          lastJSON = serialized;
          callback(data.map((m: any) => ({
            ...m,
            createdAt: new Date(m.createdAt)
          })));
        }
      } catch (error) {
        console.warn("Backend members fetch failed, falling back to localStorage.", error);
        // Fallback
        const localRaw = localStorage.getItem('we_members');
        if (localRaw) {
          const list = JSON.parse(localRaw);
          callback(list.map((m: any) => ({ ...m, createdAt: new Date(m.createdAt || Date.now()) })));
        }
      }
    };

    poll();
    const handle = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(handle);
    };
  },

  async addMember(name: string): Promise<void> {
    try {
      await fetchJSON('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
    } catch (e) {
      console.warn("Backend addMember failed, writing to local storage too.", e);
      // Fallback local storage sync
      const localRaw = localStorage.getItem('we_members') || '[]';
      const list = JSON.parse(localRaw);
      const cleanId = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (!list.some((m: any) => m.name.toLowerCase() === name.toLowerCase())) {
        list.push({ id: cleanId, name, createdAt: new Date().toISOString() });
        localStorage.setItem('we_members', JSON.stringify(list));
      }
    }
  },

  // Dishes real-time subscriptions
  subscribeDishes(callback: (dishes: Dish[]) => void) {
    let active = true;
    let lastJSON = '';

    const poll = async () => {
      try {
        const data = await fetchJSON('/api/dishes');
        if (!active) return;
        const serialized = JSON.stringify(data);
        if (serialized !== lastJSON) {
          lastJSON = serialized;
          callback(data.map((d: any) => ({
            ...d,
            createdAt: new Date(d.createdAt)
          })));
        }
      } catch (error) {
        console.warn("Backend dishes fetch failed, falling back to localStorage.", error);
        const localRaw = localStorage.getItem('we_dishes');
        if (localRaw) {
          const list = JSON.parse(localRaw);
          callback(list.map((d: any) => ({ ...d, createdAt: new Date(d.createdAt || Date.now()) })));
        }
      }
    };

    poll();
    const handle = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(handle);
    };
  },

  async addDish(dish: Omit<Dish, 'id' | 'createdAt'>): Promise<string> {
    try {
      const savedDish = await fetchJSON('/api/dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dish)
      });
      return savedDish.id;
    } catch (e) {
      console.warn("Backend addDish failed, using local storage fallback", e);
      const generatedId = Math.random().toString(36).substring(2, 11);
      const raw = localStorage.getItem('we_dishes') || '[]';
      const list = JSON.parse(raw);
      const val = { ...dish, id: generatedId, createdAt: new Date().toISOString() };
      list.push(val);
      localStorage.setItem('we_dishes', JSON.stringify(list));
      return generatedId;
    }
  },

  async deleteDish(dishId: string): Promise<void> {
    try {
      await fetchJSON(`/api/dishes/${dishId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn("Backend deleteDish failed, deleting from local storage", e);
      const raw = localStorage.getItem('we_dishes') || '[]';
      let list = JSON.parse(raw);
      list = list.filter((d: any) => d.id !== dishId);
      localStorage.setItem('we_dishes', JSON.stringify(list));
    }
  },

  // Ratings real-time subscription for ALL dishes
  subscribeAllRatings(callback: (ratings: { [dishId: string]: Rating[] }) => void) {
    let active = true;
    let lastJSON = '';

    const poll = async () => {
      try {
        const data = await fetchJSON('/api/ratings');
        if (!active) return;
        const serialized = JSON.stringify(data);
        if (serialized !== lastJSON) {
          lastJSON = serialized;
          const map: { [dishId: string]: Rating[] } = {};
          Object.keys(data).forEach((dishId) => {
            map[dishId] = data[dishId].map((r: any) => ({
              ...r,
              updatedAt: new Date(r.updatedAt)
            }));
          });
          callback(map);
        }
      } catch (error) {
        console.warn("Backend ratings fetch failed, falling back to localStorage.", error);
        const raw = localStorage.getItem('we_ratings') || '{}';
        const ratingsMap = JSON.parse(raw);
        const parsedMap: { [dishId: string]: Rating[] } = {};
        Object.keys(ratingsMap).forEach(dishId => {
          parsedMap[dishId] = Object.keys(ratingsMap[dishId]).map(memberName => ({
            id: memberName,
            score: ratingsMap[dishId][memberName],
            ratedBy: memberName,
            updatedAt: new Date()
          }));
        });
        callback(parsedMap);
      }
    };

    poll();
    const handle = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(handle);
    };
  },

  async rateDish(dishId: string, memberName: string, score: number): Promise<void> {
    try {
      await fetchJSON('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dishId, memberName, score })
      });
    } catch (e) {
      console.warn("Backend rateDish failed, writing to local storage too", e);
      const raw = localStorage.getItem('we_ratings') || '{}';
      const ratingsMap = JSON.parse(raw);
      if (!ratingsMap[dishId]) {
        ratingsMap[dishId] = {};
      }
      ratingsMap[dishId][memberName] = score;
      localStorage.setItem('we_ratings', JSON.stringify(ratingsMap));
    }
  },

  // Planned meals real-time subscription
  subscribePlannedMeals(callback: (planned: PlannedMeal[]) => void) {
    let active = true;
    let lastJSON = '';

    const poll = async () => {
      try {
        const data = await fetchJSON('/api/planned_meals');
        if (!active) return;
        const serialized = JSON.stringify(data);
        if (serialized !== lastJSON) {
          lastJSON = serialized;
          callback(data.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt)
          })));
        }
      } catch (error) {
        console.warn("Backend planned meals fetch failed, falling back to localStorage.", error);
        const raw = localStorage.getItem('we_planned_meals') || '[]';
        const list = JSON.parse(raw);
        callback(list.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt)
        })));
      }
    };

    poll();
    const handle = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(handle);
    };
  },

  async addPlannedMeal(planned: Omit<PlannedMeal, 'id' | 'createdAt'>): Promise<string> {
    try {
      const savedMeal = await fetchJSON('/api/planned_meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planned)
      });
      return savedMeal.id;
    } catch (e) {
      console.warn("Backend addPlannedMeal failed, writing to local storage fallback", e);
      const generatedId = Math.random().toString(36).substring(2, 11);
      const raw = localStorage.getItem('we_planned_meals') || '[]';
      const list = JSON.parse(raw);
      const newItem = {
        ...planned,
        id: generatedId,
        createdAt: new Date().toISOString()
      };
      list.push(newItem);
      localStorage.setItem('we_planned_meals', JSON.stringify(list));
      return generatedId;
    }
  },

  async deletePlannedMeal(id: string): Promise<void> {
    try {
      await fetchJSON(`/api/planned_meals/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn("Backend deletePlannedMeal failed, deleting from localStorage", e);
      const raw = localStorage.getItem('we_planned_meals') || '[]';
      let list = JSON.parse(raw);
      list = list.filter((item: any) => item.id !== id);
      localStorage.setItem('we_planned_meals', JSON.stringify(list));
    }
  },

  // Shopping List real-time subscription
  subscribeShoppingList(callback: (items: any[]) => void) {
    let active = true;
    let lastJSON = '';

    const poll = async () => {
      try {
        const data = await fetchJSON('/api/shopping_list');
        if (!active) return;
        const serialized = JSON.stringify(data);
        if (serialized !== lastJSON) {
          lastJSON = serialized;
          callback(data.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt)
          })));
        }
      } catch (error) {
        console.warn("Backend shopping list fetch failed, falling back to localStorage.", error);
        const raw = localStorage.getItem('we_shopping_list') || '[]';
        const list = JSON.parse(raw);
        callback(list.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt)
        })));
      }
    };

    poll();
    const handle = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(handle);
    };
  },

  async addShoppingItems(items: any | any[]): Promise<void> {
    try {
      await fetchJSON('/api/shopping_list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items)
      });
    } catch (e) {
      console.warn("Backend addShoppingItems failed, adding to local storage", e);
      const raw = localStorage.getItem('we_shopping_list') || '[]';
      const list = JSON.parse(raw);
      const incoming = Array.isArray(items) ? items : [items];
      
      incoming.forEach(it => {
        list.push({
          ...it,
          id: Math.random().toString(36).substring(2, 11),
          createdAt: new Date().toISOString()
        });
      });
      localStorage.setItem('we_shopping_list', JSON.stringify(list));
    }
  },

  async updateShoppingItem(id: string, updates: any): Promise<void> {
    try {
      await fetchJSON(`/api/shopping_list/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {
      console.warn("Backend updateShoppingItem failed, updating localStorage", e);
      const raw = localStorage.getItem('we_shopping_list') || '[]';
      const list = JSON.parse(raw);
      const idx = list.findIndex((item: any) => item.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates };
        localStorage.setItem('we_shopping_list', JSON.stringify(list));
      }
    }
  },

  async deleteShoppingItem(id: string): Promise<void> {
    try {
      await fetchJSON(`/api/shopping_list/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn("Backend deleteShoppingItem failed, deleting from localStorage", e);
      const raw = localStorage.getItem('we_shopping_list') || '[]';
      let list = JSON.parse(raw);
      list = list.filter((item: any) => item.id !== id);
      localStorage.setItem('we_shopping_list', JSON.stringify(list));
    }
  },

  async clearShoppingList(type: 'completed' | 'all'): Promise<void> {
    try {
      await fetchJSON('/api/shopping_list/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
    } catch (e) {
      console.warn("Backend clearShoppingList failed, clearing localStorage", e);
      const raw = localStorage.getItem('we_shopping_list') || '[]';
      let list = JSON.parse(raw);
      if (type === 'completed') {
        list = list.filter((item: any) => !item.completed);
      } else {
        list = [];
      }
      localStorage.setItem('we_shopping_list', JSON.stringify(list));
    }
  }
};
