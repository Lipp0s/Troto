import express from 'express';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import bodyParser from 'body-parser';
import { open } from 'sqlite';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;
const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const JWT_SECRET = process.env.JWT_SECRET || 'troto_super_secret_key';
const PORT = 4000;

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '2mb' })); // per avatar base64

let db;

// --- DB INIT ---
async function initDb() {
  db = await open({
    filename: './troto.sqlite',
    driver: sqlite3.Database
  });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      displayName TEXT,
      bio TEXT,
      avatar TEXT,
      verified INTEGER DEFAULT 0,
      verifyToken TEXT
    );
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS likes (
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      PRIMARY KEY(user_id, post_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(post_id) REFERENCES posts(id)
    );
  `);
}

// --- AUTH MIDDLEWARE ---
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Token mancante' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token non valido' });
  }
}

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS
  }
});

// --- API ---
// REGISTRAZIONE
app.post('/api/register', async (req, res) => {
  console.log('--- [API] /api/register chiamata ---');
  const { username, email, password, displayName, bio, avatar } = req.body;
  if (!username || !email || !password) {
    console.log('Registrazione fallita: campi mancanti');
    return res.status(400).json({ error: 'Username, email e password obbligatori' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    console.log('Password hashata');
    // Salta la verifica email: utente subito verificato
    await db.run('INSERT INTO users (username, email, password, displayName, bio, avatar, verified) VALUES (?, ?, ?, ?, ?, ?, 1)', username, email, hash, displayName || '', bio || '', avatar || '');
    console.log('Utente inserito nel DB (verificato)');
    return res.json({ ok: true, message: 'Registrazione riuscita. Ora puoi accedere.' });
  } catch (e) {
    console.error('Errore durante la registrazione:', e);
    if (e.message.includes('UNIQUE constraint failed: users.username')) {
      return res.status(400).json({ error: 'Username già esistente' });
    }
    if (e.message.includes('UNIQUE constraint failed: users.email')) {
      return res.status(400).json({ error: 'Email già registrata' });
    }
    return res.status(400).json({ error: 'Errore nella registrazione' });
  }
});

// VERIFICA EMAIL
app.get('/api/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Token mancante');
  const user = await db.get('SELECT * FROM users WHERE verifyToken = ?', token);
  if (!user) return res.status(400).send('Token non valido o già usato');
  await db.run('UPDATE users SET verified = 1, verifyToken = NULL WHERE id = ?', user.id);
  res.send('<h2>Email verificata!</h2><p>Ora puoi accedere a Troto.</p>');
});

// LOGIN
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e password obbligatori' });
  const user = await db.get('SELECT * FROM users WHERE email = ?', email);
  if (!user) return res.status(400).json({ error: 'Credenziali non valide' });
  // Salta il controllo verified
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Credenziali non valide' });
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ token, username: user.username, displayName: user.displayName, bio: user.bio, avatar: user.avatar });
});

// GET USER INFO (profilo proprio)
app.get('/api/me', authMiddleware, async (req, res) => {
  const user = await db.get('SELECT id, username, displayName, bio, avatar FROM users WHERE id = ?', req.user.id);
  res.json(user);
});

// UPDATE PROFILE (profilo proprio)
app.put('/api/me', authMiddleware, async (req, res) => {
  const { displayName, bio, avatar } = req.body;
  await db.run('UPDATE users SET displayName = ?, bio = ?, avatar = ? WHERE id = ?', displayName || '', bio || '', avatar || '', req.user.id);
  const user = await db.get('SELECT id, username, displayName, bio, avatar FROM users WHERE id = ?', req.user.id);
  res.json(user);
});

// GET PUBLIC PROFILE
app.get('/api/users/:username', async (req, res) => {
  const user = await db.get('SELECT username, displayName, bio, avatar FROM users WHERE username = ?', req.params.username);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  res.json(user);
});

// CREA POST
app.post('/api/posts', authMiddleware, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Testo obbligatorio' });
  const date = new Date().toISOString();
  await db.run('INSERT INTO posts (user_id, text, date) VALUES (?, ?, ?)', req.user.id, text.trim(), date);
  res.json({ ok: true });
});

// LEGGI FEED (tutti i post, più info utente e like)
app.get('/api/posts', authMiddleware, async (req, res) => {
  const posts = await db.all(`
    SELECT p.id, p.text, p.date, u.username, u.displayName, u.avatar,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likeCount,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as liked
    FROM posts p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.date DESC
  `, req.user.id);
  res.json(posts.map(p => ({
    id: p.id,
    text: p.text,
    date: p.date,
    user: {
      username: p.username,
      displayName: p.displayName,
      avatar: p.avatar
    },
    likeCount: p.likeCount,
    liked: !!p.liked
  })));
});

// POST UTENTE
app.get('/api/users/:username/posts', authMiddleware, async (req, res) => {
  const user = await db.get('SELECT id FROM users WHERE username = ?', req.params.username);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  const posts = await db.all(`
    SELECT p.id, p.text, p.date, u.username, u.displayName, u.avatar,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likeCount,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as liked
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ?
    ORDER BY p.date DESC
  `, req.user.id, user.id);
  res.json(posts.map(p => ({
    id: p.id,
    text: p.text,
    date: p.date,
    user: {
      username: p.username,
      displayName: p.displayName,
      avatar: p.avatar
    },
    likeCount: p.likeCount,
    liked: !!p.liked
  })));
});

// LIKE/UNLIKE
app.post('/api/posts/:id/like', authMiddleware, async (req, res) => {
  const post = await db.get('SELECT * FROM posts WHERE id = ?', req.params.id);
  if (!post) return res.status(404).json({ error: 'Post non trovato' });
  const like = await db.get('SELECT * FROM likes WHERE user_id = ? AND post_id = ?', req.user.id, req.params.id);
  if (like) {
    // Unlike
    await db.run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', req.user.id, req.params.id);
    return res.json({ liked: false });
  } else {
    // Like
    await db.run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', req.user.id, req.params.id);
    return res.json({ liked: true });
  }
});

// --- START ---
initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('Troto backend listening on http://0.0.0.0:' + PORT);
  });
}); 