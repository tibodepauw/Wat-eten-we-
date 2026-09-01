/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable reverse proxy trust
app.set('trust proxy', 1);

// Enable JSON parsing with reasonable body limit
app.use(express.json({ limit: '15mb' }));

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');
const UPLOADS_DIR = path.join(DB_DIR, 'uploads');

// Ensure directories exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded images statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Session secret generation / persistence
const SECRET_FILE = path.join(DB_DIR, '.session_secret');
let SESSION_SECRET = process.env.SESSION_SECRET || '';
if (!SESSION_SECRET) {
  if (fs.existsSync(SECRET_FILE)) {
    SESSION_SECRET = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
  } else {
    SESSION_SECRET = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(SECRET_FILE, SESSION_SECRET, 'utf-8');
    } catch {
      // Ignore if write fails
    }
  }
}

// Token generation and verification
function createToken(payload: { id: string; name: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const data = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${data}`).digest('base64url');
  return `${header}.${data}.${signature}`;
}

function verifyToken(token: string): { id: string; name: string } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, data, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${data}`).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    return parsed;
  } catch {
    return null;
  }
}

// Authentication middleware
interface AuthenticatedRequest extends Request {
  user?: { id: string; name: string };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || (req.headers['x-auth-token'] as string);
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (authHeader) {
    token = authHeader.trim();
  }

  if (!token) {
    res.status(401).json({ error: 'Geen geldige autorisatie gevonden. Log opnieuw in.' });
    return;
  }

  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'Sessie is verlopen of ongeldig. Log opnieuw in.' });
    return;
  }

  req.user = user;
  next();
}

// Password hashing helpers (Asynchronous)
async function hashPasswordAsync(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) => {
    crypto.scrypt(password.normalize(), salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt.toString('hex')}:${derivedKey.toString('hex')}`);
    });
  });
}

async function verifyPasswordAsync(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;
  if (!storedHash.startsWith('scrypt:')) {
    // Legacy plaintext support for automatic migration
    return storedHash.trim().toLowerCase() === password.trim().toLowerCase();
  }
  const parts = storedHash.split(':');
  if (parts.length !== 3) return false;
  const [, salt, hash] = parts;

  return new Promise((resolve) => {
    const saltBuf = Buffer.from(salt, 'hex');
    crypto.scrypt(password.normalize(), saltBuf, 64, (err, derivedKey) => {
      if (err) return resolve(false);
      try {
        const matches = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derivedKey);
        resolve(matches);
      } catch {
        resolve(false);
      }
    });
  });
}

// Synchronous helper for initial seed only
function hashPasswordSync(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password.normalize(), salt, 64).toString('hex');
  return `scrypt:${salt.toString('hex')}:${hash}`;
}

// In-memory rate limiting for login attempts with automatic memory pruning
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) {
    return false;
  }
  entry.count++;
  return true;
}

// Periodically clean up expired login attempts every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts.entries()) {
    if (now > entry.resetAt) {
      loginAttempts.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// --- Brevo 2FA Configuration and Helper ---
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@watetenwe.app';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Wat eten we';

// Temporary 2FA verification storage (tempToken -> { code, expiresAt, member })
const twoFactorSessions = new Map<string, { code: string; expiresAt: number; member: any }>();

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `*@${domain}`;
  return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`;
}

async function sendBrevoEmail(toEmail: string, name: string, code: string): Promise<boolean> {
  if (!BREVO_API_KEY) {
    console.log(`[Brevo 2FA Dev Mode] Verificatiecode voor ${name} (${toEmail}): ${code}`);
    return true;
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        to: [{ email: toEmail, name: name }],
        subject: 'Je verificatiecode voor Wat eten we',
        htmlContent: `<!DOCTYPE html><html><body style="font-family: sans-serif; padding: 20px; color: #311300;">
          <h2 style="color: #8F4E00;">Wat eten we?</h2>
          <p>Hallo ${name},</p>
          <p>Je tijdelijke verificatiecode voor tweestapsverificatie is:</p>
          <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; padding: 12px 24px; background: #FFDCC0; color: #8F4E00; display: inline-block; border-radius: 12px; margin: 16px 0;">${code}</div>
          <p style="color: #666; font-size: 13px;">Deze code is 10 minuten geldig. Deel deze code met niemand.</p>
        </body></html>`
      })
    });
    return res.ok;
  } catch (error) {
    console.error('Error sending Brevo email:', error);
    return false;
  }
}

// Prune expired 2FA sessions
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of twoFactorSessions.entries()) {
    if (now > entry.expiresAt) {
      twoFactorSessions.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Generic default initial state (clean public template)
const DEFAULT_DB = {
  members: [
    { id: 'chef', name: 'Chef', password: hashPasswordSync('chef'), avatarColor: '#8F4E00', avatarLetter: 'C', avatarIcon: 'smile', email: '', twoFactorEnabled: false, createdAt: new Date().toISOString() },
    { id: 'proever', name: 'Proever', password: hashPasswordSync('proever'), avatarColor: '#5a7862', avatarLetter: 'P', avatarIcon: 'heart', email: '', twoFactorEnabled: false, createdAt: new Date().toISOString() }
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
        { name: 'Bruin bier', amount: '2 flesjes', category: 'Kruidenier & Droogwaren' },
        { name: 'Sneetje bruin brood', amount: '1 plak', category: 'Bakkerij' },
        { name: 'Mosterd', amount: '2 el', category: 'Kruidenier & Droogwaren' },
        { name: 'Frites', amount: '1 kg', category: 'Overig' }
      ],
      recipe: '1. Snijd de runderlappen in blokjes en bestrooi met zout en peper.\n2. Bak het vlees bruin in boter.\n3. Voeg gesnipperde uien toe en bak mee.\n4. Blus af met bruin bier en runderbouillon.\n5. Voeg een snee brood met mosterd en kruiden toe.\n6. Laat 3 uur zachtjes stoven.\n7. Serveer met vers gebakken frietjes en mayonaise.',
      createdAt: new Date().toISOString(),
      addedBy: 'Chef'
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
      recipe: '1. Kook de spaghetti volgens de verpakking al dente.\n2. Fruit ui en knoflook in olijfolie.\n3. Voeg gehakt toe en rul het bruin.\n4. Voeg fijngesneden wortel, bleekselderij en tomatenpuree toe.\n5. Voeg gepelde tomaten en Italiaanse kruiden toe.\n6. Laat 30 minuten sudderen.\n7. Bestrooi met Parmezaanse kaas.',
      createdAt: new Date().toISOString(),
      addedBy: 'Proever'
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
      addedBy: 'Chef'
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
      addedBy: 'Proever'
    }
  ],
  ratings: {
    '1': { 'Chef': 10, 'Proever': 8 },
    '2': { 'Chef': 8, 'Proever': 10 },
    '3': { 'Chef': 7, 'Proever': 9 },
    '4': { 'Chef': 8, 'Proever': 10 }
  },
  planned_meals: [],
  shopping_list: []
};

// In-Memory Database Cache with Serialized Async Write Queue
let memoryDB: any = null;
let writeQueue: Promise<void> = Promise.resolve();

function initDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      memoryDB = JSON.parse(JSON.stringify(DEFAULT_DB));
      const tempFile = path.join(DB_DIR, `db.json.${crypto.randomUUID()}.tmp`);
      fs.writeFileSync(tempFile, JSON.stringify(memoryDB, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
      return;
    }

    const content = fs.readFileSync(DB_FILE, 'utf-8');
    memoryDB = JSON.parse(content);
    let modified = false;

    // Migrate passwords and 2FA defaults
    if (memoryDB.members && Array.isArray(memoryDB.members)) {
      memoryDB.members = memoryDB.members.map((m: any) => {
        if (!m.password || !m.password.startsWith('scrypt:')) {
          m.password = hashPasswordSync(m.password || m.name.toLowerCase());
          modified = true;
        }
        if (m.twoFactorEnabled === undefined) {
          m.twoFactorEnabled = false;
          modified = true;
        }
        if (m.email === undefined) {
          m.email = '';
          modified = true;
        }
        return m;
      });
    }

    // Migrate any base64 images to uploads folder
    if (memoryDB.dishes && Array.isArray(memoryDB.dishes)) {
      memoryDB.dishes.forEach((d: any) => {
        if (d.imageUrl && typeof d.imageUrl === 'string' && d.imageUrl.startsWith('data:image/')) {
          try {
            const matches = d.imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
            if (matches) {
              const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
              const filename = `dish_${crypto.randomUUID()}.${ext}`;
              const filePath = path.join(UPLOADS_DIR, filename);
              fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
              d.imageUrl = `/uploads/${filename}`;
              modified = true;
            }
          } catch (e) {
            console.error('Error migrating base64 image for dish', d.id, e);
          }
        }
      });
    }

    if (modified) {
      const tempFile = path.join(DB_DIR, `db.json.${crypto.randomUUID()}.tmp`);
      fs.writeFileSync(tempFile, JSON.stringify(memoryDB, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    }
  } catch (error) {
    console.error('Error initializing DB from file, falling back to default:', error);
    memoryDB = JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

// Asynchronous Atomic Database Persistence
function persistDB(): Promise<void> {
  const snapshot = JSON.stringify(memoryDB, null, 2);
  writeQueue = writeQueue.then(async () => {
    try {
      const tempFile = path.join(DB_DIR, `db.json.${crypto.randomUUID()}.tmp`);
      await fs.promises.writeFile(tempFile, snapshot, 'utf-8');
      await fs.promises.rename(tempFile, DB_FILE);
    } catch (err) {
      console.error('Error writing database to disk:', err);
    }
  });
  return writeQueue;
}

// Initialize memory database at startup
initDatabase();

// --- Smart Amount Merging Utility ---
function mergeAmounts(a: string, b: string): string {
  a = (a || '').trim();
  b = (b || '').trim();
  if (!a) return b;
  if (!b) return a;

  const regex = /^([\d.,]+)\s*(.*)$/;
  const matchA = a.match(regex);
  const matchB = b.match(regex);

  if (matchA && matchB) {
    const numA = parseFloat(matchA[1].replace(',', '.'));
    const numB = parseFloat(matchB[1].replace(',', '.'));
    const unitA = matchA[2].trim().toLowerCase();
    const unitB = matchB[2].trim().toLowerCase();

    if (!isNaN(numA) && !isNaN(numB)) {
      if (unitA === unitB) {
        const sum = numA + numB;
        const formattedSum = Number(sum.toFixed(2));
        return matchA[2].trim() ? `${formattedSum} ${matchA[2].trim()}` : `${formattedSum}`;
      }

      // Weight conversions: kg & g
      const isKgA = unitA === 'kg' || unitA === 'kilo';
      const isKgB = unitB === 'kg' || unitB === 'kilo';
      const isGA = unitA === 'g' || unitA === 'gr' || unitA === 'gram';
      const isGB = unitB === 'g' || unitB === 'gr' || unitB === 'gram';

      if ((isKgA || isGA) && (isKgB || isGB)) {
        const totalGrams = (isKgA ? numA * 1000 : numA) + (isKgB ? numB * 1000 : numB);
        if (totalGrams >= 1000 && totalGrams % 100 === 0) {
          return `${Number((totalGrams / 1000).toFixed(2))} kg`;
        }
        return `${Number(totalGrams.toFixed(2))} g`;
      }

      // Volume conversions: l & ml
      const isLA = unitA === 'l' || unitA === 'liter';
      const isLB = unitB === 'l' || unitB === 'liter';
      const isMlA = unitA === 'ml' || unitA === 'milliliter';
      const isMlB = unitB === 'ml' || unitB === 'milliliter';

      if ((isLA || isMlA) && (isLB || isMlB)) {
        const totalMl = (isLA ? numA * 1000 : numA) + (isLB ? numB * 1000 : numB);
        if (totalMl >= 1000 && totalMl % 100 === 0) {
          return `${Number((totalMl / 1000).toFixed(2))} l`;
        }
        return `${Number(totalMl.toFixed(2))} ml`;
      }

      return `${a} + ${b}`;
    }
  }

  if (a.toLowerCase() === b.toLowerCase()) {
    return a;
  }
  return `${a} + ${b}`;
}

// --- API Endpoints ---

// POST: Dedicated Image Upload Endpoint
app.post('/api/upload-image', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { image } = req.body;
    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'Afbeeldingsdata is verplicht.' });
      return;
    }

    const matches = image.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches) {
      res.status(400).json({ error: 'Ongeldig afbeeldingsformaat (data-url vereist).' });
      return;
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const filename = `dish_${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    const buffer = Buffer.from(matches[2], 'base64');

    await fs.promises.writeFile(filePath, buffer);
    res.json({ url: `/uploads/${filename}` });
  } catch (error) {
    console.error('Error handling image upload:', error);
    res.status(500).json({ error: 'Fout bij het opslaan van de afbeelding.' });
  }
});

// GET: Unified snapshot for real-time synchronization
app.get('/api/sync', (_req: Request, res: Response) => {
  const publicMembers = (memoryDB.members || []).map(({ password, ...rest }: any) => rest);

  const rawRatings = memoryDB.ratings || {};
  const formattedRatings: { [dishId: string]: any[] } = {};
  Object.keys(rawRatings).forEach((dishId) => {
    formattedRatings[dishId] = Object.keys(rawRatings[dishId]).map((memberName) => ({
      id: memberName,
      score: rawRatings[dishId][memberName],
      ratedBy: memberName,
      updatedAt: new Date().toISOString()
    }));
  });

  res.json({
    members: publicMembers,
    dishes: memoryDB.dishes || [],
    ratings: formattedRatings,
    planned_meals: memoryDB.planned_meals || [],
    shopping_list: memoryDB.shopping_list || [],
    timestamp: Date.now()
  });
});

// GET: All members (sanitized)
app.get('/api/members', (_req: Request, res: Response) => {
  const publicMembers = (memoryDB.members || []).map(({ password, ...rest }: any) => rest);
  res.json(publicMembers);
});

// POST: Add new member (Self-service signup)
app.post('/api/members', async (req: Request, res: Response) => {
  const { name, password, avatarColor, avatarLetter, avatarIcon, email, twoFactorEnabled } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Naam is verplicht.' });
    return;
  }
  const cleanName = name.trim();
  if (cleanName.length > 20) {
    res.status(400).json({ error: 'Naam mag maximaal 20 tekens zijn.' });
    return;
  }

  if (!memoryDB.members) memoryDB.members = [];

  const alreadyExists = memoryDB.members.some((m: any) => m.name.toLowerCase() === cleanName.toLowerCase());
  if (alreadyExists) {
    res.status(400).json({ error: 'Dit gezinslid bestaat al!' });
    return;
  }

  const rawPassword = password ? password.trim() : cleanName.toLowerCase();
  const hashedPassword = await hashPasswordAsync(rawPassword);
  const cleanId = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_') || `user_${crypto.randomUUID().slice(0, 8)}`;

  const newMember = {
    id: cleanId,
    name: cleanName,
    password: hashedPassword,
    avatarColor: avatarColor || '#8F4E00',
    avatarLetter: avatarLetter || cleanName.charAt(0).toUpperCase(),
    avatarIcon: avatarIcon || '',
    email: email ? String(email).trim().toLowerCase() : '',
    twoFactorEnabled: !!twoFactorEnabled,
    createdAt: new Date().toISOString()
  };

  memoryDB.members.push(newMember);
  persistDB();

  const { password: _, ...publicMember } = newMember;
  const token = createToken({ id: publicMember.id, name: publicMember.name });
  res.json({ ...publicMember, token });
});

// POST: Login securely with rate limiting and optional Brevo 2FA
app.post('/api/members/login', async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkLoginRateLimit(ip)) {
    res.status(429).json({ error: 'Te veel inlogpogingen. Probeer het over een minuut opnieuw.' });
    return;
  }

  const { name, password } = req.body;
  if (!name || !password) {
    res.status(400).json({ error: 'Naam en wachtwoord zijn verplicht.' });
    return;
  }

  const member = (memoryDB.members || []).find((m: any) => m.name.toLowerCase() === name.trim().toLowerCase());
  if (!member) {
    res.status(404).json({ error: 'Gezinslid niet gevonden.' });
    return;
  }

  const matches = await verifyPasswordAsync(password.trim(), member.password || '');
  if (!matches) {
    res.status(401).json({ error: 'Onjuist wachtwoord.' });
    return;
  }

  // Check optional 2FA via Brevo email
  if (member.twoFactorEnabled && member.email) {
    const code = String(crypto.randomInt(100000, 999999));
    const tempToken = crypto.randomUUID();
    twoFactorSessions.set(tempToken, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      member
    });

    await sendBrevoEmail(member.email, member.name, code);
    res.json({
      requires2FA: true,
      tempToken,
      emailMasked: maskEmail(member.email),
      message: `Verificatiecode verzonden naar ${maskEmail(member.email)}`
    });
    return;
  }

  const { password: _, ...publicMember } = member;
  const token = createToken({ id: publicMember.id, name: publicMember.name });
  res.json({ success: true, member: publicMember, token });
});

// POST: Verify 2FA code
app.post('/api/members/verify-2fa', (req: Request, res: Response) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) {
    res.status(400).json({ error: 'Verificatiecode en sessie-identificatie zijn verplicht.' });
    return;
  }

  const session = twoFactorSessions.get(tempToken);
  if (!session || Date.now() > session.expiresAt) {
    twoFactorSessions.delete(tempToken);
    res.status(400).json({ error: 'Verificatiecode is verlopen of ongeldig. Log opnieuw in.' });
    return;
  }

  if (session.code !== String(code).trim()) {
    res.status(400).json({ error: 'Onjuiste verificatiecode.' });
    return;
  }

  twoFactorSessions.delete(tempToken);
  const { password: _, ...publicMember } = session.member;
  const token = createToken({ id: publicMember.id, name: publicMember.name });
  res.json({ success: true, member: publicMember, token });
});

// PUT: Update member details
app.put('/api/members/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, password, avatarColor, avatarLetter, avatarIcon, email, twoFactorEnabled } = req.body;

  if (!memoryDB.members) memoryDB.members = [];

  const memberIdx = memoryDB.members.findIndex((m: any) => m.id === id);
  if (memberIdx === -1) {
    res.status(404).json({ error: 'Gezinslid niet gevonden.' });
    return;
  }

  const oldMember = memoryDB.members[memberIdx];
  const oldName = oldMember.name;
  const newName = name ? name.trim() : oldName;

  if (newName.toLowerCase() !== oldName.toLowerCase()) {
    const nameTaken = memoryDB.members.some((m: any) => m.id !== id && m.name.toLowerCase() === newName.toLowerCase());
    if (nameTaken) {
      res.status(400).json({ error: 'Deze naam is al in gebruik.' });
      return;
    }
  }

  let updatedPassword = oldMember.password;
  if (password !== undefined && password.trim() !== '') {
    updatedPassword = await hashPasswordAsync(password.trim());
  }

  const updatedMember = {
    ...oldMember,
    name: newName,
    id: newName.toLowerCase().replace(/[^a-z0-9]/g, '_') || oldMember.id,
    password: updatedPassword,
    avatarColor: avatarColor || oldMember.avatarColor,
    avatarLetter: avatarLetter || oldMember.avatarLetter,
    avatarIcon: avatarIcon !== undefined ? avatarIcon : oldMember.avatarIcon,
    email: email !== undefined ? String(email).trim().toLowerCase() : (oldMember.email || ''),
    twoFactorEnabled: twoFactorEnabled !== undefined ? !!twoFactorEnabled : !!oldMember.twoFactorEnabled
  };

  memoryDB.members[memberIdx] = updatedMember;

  // Consistent Cascade update across all datasets
  if (newName !== oldName) {
    if (memoryDB.dishes && Array.isArray(memoryDB.dishes)) {
      memoryDB.dishes.forEach((d: any) => {
        if (d.addedBy === oldName) {
          d.addedBy = newName;
        }
      });
    }
    if (memoryDB.ratings) {
      Object.keys(memoryDB.ratings).forEach((dishId) => {
        const dishRatings = memoryDB.ratings[dishId];
        if (dishRatings && dishRatings[oldName] !== undefined) {
          dishRatings[newName] = dishRatings[oldName];
          delete dishRatings[oldName];
        }
      });
    }
    if (memoryDB.shopping_list && Array.isArray(memoryDB.shopping_list)) {
      memoryDB.shopping_list.forEach((item: any) => {
        if (item.addedBy === oldName) {
          item.addedBy = newName;
        }
      });
    }
    if (memoryDB.planned_meals && Array.isArray(memoryDB.planned_meals)) {
      memoryDB.planned_meals.forEach((meal: any) => {
        if (meal.addedBy === oldName) {
          meal.addedBy = newName;
        }
      });
    }
  }

  persistDB();

  const { password: _, ...publicMember } = updatedMember;
  const token = createToken({ id: publicMember.id, name: publicMember.name });
  res.json({ success: true, member: publicMember, token });
});

// DELETE: Delete a family member
app.delete('/api/members/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!memoryDB.members) memoryDB.members = [];

  const memberToDelete = memoryDB.members.find((m: any) => m.id === id);
  if (!memberToDelete) {
    res.status(404).json({ error: 'Gezinslid niet gevonden.' });
    return;
  }

  if (memoryDB.members.length <= 1) {
    res.status(400).json({ error: 'Er moet minstens één gezinslid bewaard blijven.' });
    return;
  }

  const memberName = memberToDelete.name;
  memoryDB.members = memoryDB.members.filter((m: any) => m.id !== id);

  if (memoryDB.ratings) {
    Object.keys(memoryDB.ratings).forEach((dishId) => {
      if (memoryDB.ratings[dishId] && memoryDB.ratings[dishId][memberName] !== undefined) {
        delete memoryDB.ratings[dishId][memberName];
      }
    });
  }

  persistDB();
  res.json({ success: true });
});

// GET: All dishes
app.get('/api/dishes', (_req: Request, res: Response) => {
  res.json(memoryDB.dishes || []);
});

// POST: Add new dish
app.post('/api/dishes', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const dish = req.body;
  if (!dish || !dish.name || typeof dish.name !== 'string' || dish.name.trim().length === 0) {
    res.status(400).json({ error: 'Naam van het gerecht is verplicht.' });
    return;
  }

  const generatedId = crypto.randomUUID();
  const newDish = {
    ...dish,
    name: dish.name.trim(),
    id: generatedId,
    createdAt: new Date().toISOString()
  };

  if (!memoryDB.dishes) memoryDB.dishes = [];
  memoryDB.dishes.push(newDish);
  persistDB();
  res.json(newDish);
});

// PUT: Update an existing dish
app.put('/api/dishes/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  if (!memoryDB.dishes) memoryDB.dishes = [];

  const idx = memoryDB.dishes.findIndex((d: any) => d.id === id);
  if (idx !== -1) {
    memoryDB.dishes[idx] = {
      ...memoryDB.dishes[idx],
      ...updates,
      id // Protect ID
    };
    persistDB();
    res.json(memoryDB.dishes[idx]);
  } else {
    res.status(404).json({ error: 'Gerecht niet gevonden.' });
  }
});

// DELETE: Delete dish
app.delete('/api/dishes/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  memoryDB.dishes = (memoryDB.dishes || []).filter((d: any) => d.id !== id);
  if (memoryDB.ratings) {
    delete memoryDB.ratings[id];
  }
  memoryDB.planned_meals = (memoryDB.planned_meals || []).filter((m: any) => m.dishId !== id);
  persistDB();
  res.json({ success: true });
});

// GET: All ratings
app.get('/api/ratings', (_req: Request, res: Response) => {
  const rawRatings = memoryDB.ratings || {};
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

// POST: Add or update custom member rating (with strict validation)
app.post('/api/ratings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { dishId, memberName, score } = req.body;
  if (!dishId || !memberName || score === undefined) {
    res.status(400).json({ error: 'dishId, memberName en score zijn verplicht.' });
    return;
  }

  const numScore = Number(score);
  if (!Number.isFinite(numScore) || numScore < 1 || numScore > 10) {
    res.status(400).json({ error: 'Score moet een getal zijn tussen 1 en 10.' });
    return;
  }

  if (!memoryDB.ratings) memoryDB.ratings = {};
  if (!memoryDB.ratings[dishId]) memoryDB.ratings[dishId] = {};

  memoryDB.ratings[dishId][memberName] = numScore;
  persistDB();
  res.json({ success: true });
});

// GET: All planned meals
app.get('/api/planned_meals', (_req: Request, res: Response) => {
  res.json(memoryDB.planned_meals || []);
});

// POST: Schedule a meal
app.post('/api/planned_meals', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const meal = req.body;
  if (!meal || !meal.dishId || !meal.plannedDate) {
    res.status(400).json({ error: 'dishId en plannedDate zijn verplicht.' });
    return;
  }

  const generatedId = crypto.randomUUID();
  const newMeal = {
    ...meal,
    id: generatedId,
    createdAt: new Date().toISOString()
  };

  if (!memoryDB.planned_meals) memoryDB.planned_meals = [];
  memoryDB.planned_meals.push(newMeal);
  persistDB();
  res.json(newMeal);
});

// DELETE: Delete a scheduled meal
app.delete('/api/planned_meals/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  memoryDB.planned_meals = (memoryDB.planned_meals || []).filter((m: any) => m.id !== id);
  persistDB();
  res.json({ success: true });
});

// GET: Fetch all shopping list items
app.get('/api/shopping_list', (_req: Request, res: Response) => {
  res.json(memoryDB.shopping_list || []);
});

// POST: Add new item(s) to shopping list
app.post('/api/shopping_list', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const body = req.body;
  if (!memoryDB.shopping_list) memoryDB.shopping_list = [];

  const addSingleItem = (itemObj: any) => {
    const nameNorm = (itemObj.name || '').trim().toLowerCase();
    const categoryVal = itemObj.category || 'Overig';
    const isCompleted = !!itemObj.completed;

    if (!isCompleted) {
      const existingIndex = memoryDB.shopping_list.findIndex((item: any) =>
        !item.completed &&
        (item.name || '').trim().toLowerCase() === nameNorm &&
        (item.category || 'Overig') === categoryVal
      );

      if (existingIndex !== -1) {
        const existingItem = memoryDB.shopping_list[existingIndex];
        const newAmount = mergeAmounts(existingItem.amount, itemObj.amount);
        memoryDB.shopping_list[existingIndex] = {
          ...existingItem,
          amount: newAmount
        };
        return memoryDB.shopping_list[existingIndex];
      }
    }

    const generatedId = crypto.randomUUID();
    const newItem = {
      id: generatedId,
      name: (itemObj.name || 'Onbekend').trim(),
      amount: (itemObj.amount || '').trim(),
      category: categoryVal,
      completed: isCompleted,
      addedBy: itemObj.addedBy || req.user?.name || 'Systeem',
      createdAt: new Date().toISOString()
    };
    memoryDB.shopping_list.push(newItem);
    return newItem;
  };

  if (Array.isArray(body)) {
    const addedItems = body.map(item => addSingleItem(item));
    persistDB();
    res.json(addedItems);
  } else {
    if (!body || !body.name) {
      res.status(400).json({ error: 'Naam is verplicht.' });
      return;
    }
    const addedItem = addSingleItem(body);
    persistDB();
    res.json(addedItem);
  }
});

// PUT: Modify a shopping item
app.put('/api/shopping_list/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  if (!memoryDB.shopping_list) memoryDB.shopping_list = [];

  const index = memoryDB.shopping_list.findIndex((item: any) => item.id === id);
  if (index !== -1) {
    memoryDB.shopping_list[index] = {
      ...memoryDB.shopping_list[index],
      ...updates,
      id // Protect ID
    };
    persistDB();
    res.json(memoryDB.shopping_list[index]);
  } else {
    res.status(404).json({ error: 'Item niet gevonden.' });
  }
});

// DELETE: Delete a shopping list item
app.delete('/api/shopping_list/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  memoryDB.shopping_list = (memoryDB.shopping_list || []).filter((item: any) => item.id !== id);
  persistDB();
  res.json({ success: true });
});

// POST: Clear shopping list items (batch)
app.post('/api/shopping_list/clear', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { type } = req.body;
  if (!memoryDB.shopping_list) memoryDB.shopping_list = [];

  if (type === 'completed') {
    memoryDB.shopping_list = memoryDB.shopping_list.filter((item: any) => !item.completed);
  } else if (type === 'all') {
    memoryDB.shopping_list = [];
  } else {
    res.status(400).json({ error: 'Ongeldig type. Gebruik completed of all.' });
    return;
  }

  persistDB();
  res.json({ success: true, count: memoryDB.shopping_list.length });
});

// Start server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
