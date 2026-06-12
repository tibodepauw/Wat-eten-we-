/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Enable JSON parsing with a limit of 15MB for base64 image uploads
app.use(express.json({ limit: '15mb' }));

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Default initial state matching exactly our kookboek seeding
const DEFAULT_DB = {
  members: [
    { id: 'papa', name: 'Papa', createdAt: new Date().toISOString() },
    { id: 'mama', name: 'Mama', createdAt: new Date().toISOString() },
    { id: 'tibo', name: 'Tibo', createdAt: new Date().toISOString() },
    { id: 'briek', name: 'Briek', createdAt: new Date().toISOString() }
  ],
  dishes: [
    {
      id: '1',
      name: 'Vlaamse frites met stoverij',
      description: 'Heerlijke goudgele frietjes geserveerd met rijk en zacht gegaard stoofvlees.',
      cuisine: 'Belgisch',
      imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=600&auto=format&fit=crop',
      tags: ['Klassieker', 'Comfort Food', 'Vlees'],
      suitableMoments: ['Warm eten'],
      ingredients: [
        { name: 'Runderlappen', amount: '1 kg', category: 'Vlees & Vis' },
        { name: 'Grote uien', amount: '4 stuks', category: 'Groenten & Fruit' },
        { name: 'Bruin bier (bijv. Sint Bernardus)', amount: '2 flesjes', category: 'Kruidenier & Droogwaren' },
        { name: 'Sneetje bruin brood', amount: '1 plak', category: 'Bakkerij' },
        { name: 'Mosterd', amount: '2 el', category: 'Kruidenier & Droogwaren' },
        { name: 'Frites', amount: '1 kg', category: 'Overig' }
      ],
      recipe: '1. Snijd de runderlappen in blokjes en bestrooi met zout en peper.\n2. Bak het vlees bruin in boter.\n3. Voeg gesnipperde uien toe en bak mee.\n4. Blus af met bruin bier en runderbouillon.\n5. Voeg een snee brood met mosterd en kruiden toe.\n6. Laat 3 uur zachtjes stoven.\n7. Serveer met vers gebakken frietjes en mayonaise.',
      createdAt: new Date().toISOString(),
      addedBy: 'Papa'
    },
    {
      id: '2',
      name: 'Spaghetti Bolognese',
      description: 'Klassieke pastaschotel met een rijke saus van gehakt, groenten en tomaten.',
      cuisine: 'Italiaans',
      imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop',
      tags: ['Pasta', 'Snel', 'Favoriet'],
      suitableMoments: ['Warm eten'],
      ingredients: [
        { name: 'Rundergehakt', amount: '500g', category: 'Vlees & Vis' },
        { name: 'Spaghetti', amount: '1 pak', category: 'Kruidenier & Droogwaren' },
        { name: 'Gepelde tomaten', amount: '1 blik', category: 'Kruidenier & Droogwaren' },
        { name: 'Wortel', amount: '1 stuk', category: 'Groenten & Fruit' },
        { name: 'Bleekselderij', amount: '1 stengel', category: 'Groenten & Fruit' },
        { name: 'Ui', amount: '1 stuk', category: 'Groenten & Fruit' },
        { name: 'Parmezaanse kaas', amount: '100g', category: 'Zuivel' }
      ],
      recipe: '1. Kook de spaghetti volgens de verpakking al dente.\n2. Fruit ui en knoflook in olijfol.\n3. Voeg gehakt toe en rul het bruin.\n4. Voeg fijngesneden wortel, bleekselderij en tomatenpuree toe.\n5. Voeg gepelde tomaten en Italiaanse kruiden toe.\n6. Laat 30 minuten sudderen.\n7. Bestrooi met Parmezaanse kaas.',
      createdAt: new Date().toISOString(),
      addedBy: 'Mama'
    },
    {
      id: '3',
      name: 'Pannenkoeken',
      description: 'Lekkere, dunne Hollandse pannenkoeken met stroop, poedersuiker of spek.',
      cuisine: 'Hollands',
      imageUrl: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=600&auto=format&fit=crop',
      tags: ['Zoet', 'Kinderen', 'Snel'],
      suitableMoments: ['Ontbijt', 'Vieruurtje', 'Warm eten'],
      ingredients: [
        { name: 'Bloem', amount: '250g', category: 'Kruidenier & Droogwaren' },
        { name: 'Eieren', amount: '2 stuks', category: 'Zuivel' },
        { name: 'Melk', amount: '500ml', category: 'Zuivel' },
        { name: 'Snufje zout', amount: '1 snuf', category: 'Kruidenier & Droogwaren' },
        { name: 'Stroop / Poedersuiker', amount: 'naar smaak', category: 'Kruidenier & Droogwaren' }
      ],
      recipe: '1. Meng 250g bloem en een snuf zout.\n2. Voeg 2 eieren en de helft van 500ml melk toe.\n3. Klop tot een glad beslag en voeg de rest van de melk toe.\n4. Verhit boter in een koekenpan.\n5. Giet beslag erin en bak goudbruin aan beide kanten.\n6. Serveer warm met stroop of poedersuiker.',
      createdAt: new Date().toISOString(),
      addedBy: 'Tibo'
    },
    {
      id: '4',
      name: 'Rode Curry met Kip',
      description: 'Romige Thaise curry met kokosmelk, verse groenten en malse kip.',
      cuisine: 'Aziatisch',
      imageUrl: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=600&auto=format&fit=crop',
      tags: ['Pittig', 'Gezond', 'Rijst'],
      suitableMoments: ['Warm eten'],
      ingredients: [
        { name: 'Kipdijfilet', amount: '400g', category: 'Vlees & Vis' },
        { name: 'Pandanrijst', amount: '1 pak', category: 'Kruidenier & Droogwaren' },
        { name: 'Kokosmelk', amount: '1 blik', category: 'Kruidenier & Droogwaren' },
        { name: 'Rode currypasta', amount: '2 el', category: 'Kruidenier & Droogwaren' },
        { name: 'Rode paprika', amount: '1 stuk', category: 'Groenten & Fruit' },
        { name: 'Boontjes', amount: '150g', category: 'Groenten & Fruit' }
      ],
      recipe: '1. Kook pandanrijst.\n2. Fruit rode currypasta in een scheutje olie.\n3. Voeg kipdijfilet in reepjes toe en bak rondom bruin.\n4. Giet kokosmelk erbij en breng aan de kook.\n5. Voeg groenten (paprika, bamboescheuten, boontjes) toe.\n6. Laat 15 minuten pruttelen.\n7. Garneer met verse koriander.',
      createdAt: new Date().toISOString(),
      addedBy: 'Mama'
    }
  ],
  ratings: {
    '1': { 'Papa': 10, 'Mama': 8, 'Tibo': 10, 'Briek': 10 },
    '2': { 'Papa': 8, 'Mama': 10, 'Tibo': 8, 'Briek': 7 },
    '3': { 'Papa': 6, 'Mama': 6, 'Tibo': 10, 'Briek': 9 },
    '4': { 'Papa': 8, 'Mama': 10, 'Tibo': 4, 'Briek': 5 }
  },
  planned_meals: [],
  shopping_list: []
};

// Helper: Read database
function readDB() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
      return DEFAULT_DB;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading JSON DB, fallback to memory', error);
    return DEFAULT_DB;
  }
}

// Helper: Write database
function writeDB(data: any) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to JSON DB', error);
  }
}

// Ensure database is initialized
readDB();

// --- API Endpoints ---

// GET: All members
app.get('/api/members', (req, res) => {
  const db = readDB();
  res.json(db.members || []);
});

// POST: Add new member
app.post('/api/members', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Naam is verplicht.' });
    return;
  }
  const db = readDB();
  const cleanId = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  
  if (!db.members) db.members = [];
  
  const alreadyExists = db.members.some((m: any) => m.name.toLowerCase() === name.toLowerCase());
  if (!alreadyExists) {
    const newMember = {
      id: cleanId,
      name,
      createdAt: new Date().toISOString()
    };
    db.members.push(newMember);
    writeDB(db);
    res.json(newMember);
  } else {
    res.json(db.members.find((m: any) => m.name.toLowerCase() === name.toLowerCase()));
  }
});

// GET: All dishes
app.get('/api/dishes', (req, res) => {
  const db = readDB();
  res.json(db.dishes || []);
});

// POST: Add new dish
app.post('/api/dishes', (req, res) => {
  const dish = req.body;
  if (!dish || !dish.name) {
    res.status(400).json({ error: 'Naam is verplicht.' });
    return;
  }
  const db = readDB();
  const generatedId = Math.random().toString(36).substring(2, 11);
  const newDish = {
    ...dish,
    id: generatedId,
    createdAt: new Date().toISOString()
  };
  if (!db.dishes) db.dishes = [];
  db.dishes.push(newDish);
  writeDB(db);
  res.json(newDish);
});

// DELETE: Delete dish
app.delete('/api/dishes/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  db.dishes = (db.dishes || []).filter((d: any) => d.id !== id);
  if (db.ratings) {
    delete db.ratings[id];
  }
  // Also clean up any scheduled meals of this deleted dish
  db.planned_meals = (db.planned_meals || []).filter((m: any) => m.dishId !== id);
  writeDB(db);
  res.json({ success: true });
});

// GET: All ratings formatted as { [dishId]: Rating[] }
app.get('/api/ratings', (req, res) => {
  const db = readDB();
  const rawRatings = db.ratings || {};
  const formattedRatings: { [dishId: string]: any[] } = {};
  
  Object.keys(rawRatings).forEach((dishId) => {
    formattedRatings[dishId] = Object.keys(rawRatings[dishId]).map((memberName) => ({
      id: memberName,
      score: rawRatings[dishId][memberName],
      ratedBy: memberName,
      updatedAt: new Date().toISOString()
    }));
  });
  
  res.json(formattedRatings);
});

// POST: Add or update custom member rating
app.post('/api/ratings', (req, res) => {
  const { dishId, memberName, score } = req.body;
  if (!dishId || !memberName || score === undefined) {
    res.status(400).json({ error: 'dishId, memberName en score zijn verplicht.' });
    return;
  }
  const db = readDB();
  if (!db.ratings) db.ratings = {};
  if (!db.ratings[dishId]) db.ratings[dishId] = {};
  
  db.ratings[dishId][memberName] = Number(score);
  writeDB(db);
  res.json({ success: true });
});

// GET: All planned meals
app.get('/api/planned_meals', (req, res) => {
  const db = readDB();
  res.json(db.planned_meals || []);
});

// POST: Schedule a meal
app.post('/api/planned_meals', (req, res) => {
  const meal = req.body;
  if (!meal || !meal.dishId || !meal.plannedDate) {
    res.status(400).json({ error: 'dishId en plannedDate zijn verplicht.' });
    return;
  }
  const db = readDB();
  const generatedId = Math.random().toString(36).substring(2, 11);
  const newMeal = {
    ...meal,
    id: generatedId,
    createdAt: new Date().toISOString()
  };
  if (!db.planned_meals) db.planned_meals = [];
  db.planned_meals.push(newMeal);
  writeDB(db);
  res.json(newMeal);
});

// DELETE: Delete a scheduled meal
app.delete('/api/planned_meals/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  db.planned_meals = (db.planned_meals || []).filter((m: any) => m.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// --- Shopping List Endpoints ---

// GET: Fetch all shopping list items
app.get('/api/shopping_list', (req, res) => {
  const db = readDB();
  res.json(db.shopping_list || []);
});

// POST: Add new item(s) to shopping list
app.post('/api/shopping_list', (req, res) => {
  const body = req.body;
  const db = readDB();
  if (!db.shopping_list) db.shopping_list = [];

  const addSingleItem = (itemObj: any) => {
    const generatedId = Math.random().toString(36).substring(2, 11);
    const newItem = {
      id: generatedId,
      name: itemObj.name || 'Onbekend',
      amount: itemObj.amount || '',
      category: itemObj.category || 'Overig',
      completed: !!itemObj.completed,
      addedBy: itemObj.addedBy || 'Systeem',
      createdAt: new Date().toISOString()
    };
    db.shopping_list.push(newItem);
    return newItem;
  };

  if (Array.isArray(body)) {
    const addedItems = body.map(item => addSingleItem(item));
    writeDB(db);
    res.json(addedItems);
  } else {
    if (!body || !body.name) {
      res.status(400).json({ error: 'Naam is verplicht.' });
      return;
    }
    const addedItem = addSingleItem(body);
    writeDB(db);
    res.json(addedItem);
  }
});

// PUT: Modify an item (e.g. toggle checkbox or update details)
app.put('/api/shopping_list/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const db = readDB();
  if (!db.shopping_list) db.shopping_list = [];

  const index = db.shopping_list.findIndex((item: any) => item.id === id);
  if (index !== -1) {
    db.shopping_list[index] = {
      ...db.shopping_list[index],
      ...updates
    };
    writeDB(db);
    res.json(db.shopping_list[index]);
  } else {
    res.status(404).json({ error: 'Item niet gevonden.' });
  }
});

// DELETE: Delete a shopping list item
app.delete('/api/shopping_list/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  db.shopping_list = (db.shopping_list || []).filter((item: any) => item.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// POST: Clear shopping list items (batch)
// Body: { type: 'completed' | 'all' }
app.post('/api/shopping_list/clear', (req, res) => {
  const { type } = req.body;
  const db = readDB();
  if (!db.shopping_list) db.shopping_list = [];

  if (type === 'completed') {
    db.shopping_list = db.shopping_list.filter((item: any) => !item.completed);
  } else if (type === 'all') {
    db.shopping_list = [];
  } else {
    res.status(400).json({ error: 'Ongeldig type. Gebruik completed of all.' });
    return;
  }
  
  writeDB(db);
  res.json({ success: true, count: db.shopping_list.length });
});

// Start server
async function startServer() {
  // Vite dev middleware setup if not in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
