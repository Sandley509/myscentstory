#!/usr/bin/env node
/**
 * Creates (or repairs) the store owner's admin login.
 *
 *   npm run create-admin
 *
 * It asks for your email, name and a password, creates the account in
 * Supabase Auth (already confirmed, no email needed) and makes it the store
 * owner. Run it again with the same email to reset a forgotten password.
 *
 * Optional flags:  npm run create-admin -- --email you@example.com --name "Your Name" --role staff
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local,
 * and supabase/migrations/0001_commerce.sql run in your Supabase project.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import readline from 'node:readline';

// --- .env.local (read by hand so this works on any Node version) -------------
for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

if (!url || url.includes('YOUR-PROJECT')) fail('NEXT_PUBLIC_SUPABASE_URL is missing in .env.local (Supabase → Project Settings → API → Project URL).');
if (!serviceKey) fail('SUPABASE_SERVICE_ROLE_KEY is missing in .env.local (Supabase → Project Settings → API → service_role / secret key).');

// --- arguments & prompts -----------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
    return pairs;
  }, [])
);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });

// Answers are queued, so typed and pasted/piped input both work, and a closed
// input (Ctrl+D) answers '' instead of hanging.
const lines = [];
const waiting = [];
let inputClosed = false;
rl.on('line', (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)));
rl.on('close', () => {
  inputClosed = true;
  while (waiting.length) waiting.shift()('');
});

function question(prompt, hidden = false) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    if (lines.length) return resolve(lines.shift());
    if (inputClosed) return resolve('');
    const mask = hidden && process.stdin.isTTY;
    const original = rl._writeToOutput;
    // Show * instead of the password characters while it is typed.
    if (mask) rl._writeToOutput = (text) => original.call(rl, text.replace(/[^\r\n]/g, '*'));
    waiting.push((answer) => {
      if (mask) rl._writeToOutput = original;
      resolve(answer);
    });
  });
}
const ask = async (prompt) => (await question(prompt)).trim();
const askHidden = (prompt) => question(prompt, true);

console.log('\nMyScentStory: create your admin login\n');

const email = (args.email && args.email !== 'true' ? args.email : await ask('Email: ')).toLowerCase();
if (!email) fail('Enter the email address you want to sign in with.');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`“${email}” isn’t a valid email address.`);
const name = args.name && args.name !== 'true' ? args.name : await ask('Your name (optional): ');
const role = args.role === 'staff' ? 'staff' : 'owner';

let password = process.env.ADMIN_PASSWORD || '';
if (!password) {
  password = await askHidden('Password (at least 8 characters): ');
  const again = await askHidden('Repeat password: ');
  if (password !== again) fail('The two passwords don’t match.');
}
rl.close();
if (password.length < 8) fail('The password must be at least 8 characters.');

// --- create or update the account --------------------------------------------
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser(address) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === address);
    if (hit || data.users.length < 200) return hit ?? null;
  }
  return null;
}

let userId;
let reset = false;
try {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: name ? { name } : undefined
  });
  if (error) {
    if (!/already|exists|registered/i.test(error.message)) throw error;
    const existing = await findUser(email);
    if (!existing) throw error;
    const { error: upd } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (upd) throw upd;
    userId = existing.id;
    reset = true;
  } else {
    userId = data.user.id;
  }
} catch (e) {
  const msg = e?.message || String(e);
  if (/invalid api key|jwt|apikey|401|403/i.test(msg)) fail(`Supabase refused the key: ${msg}\n  Check SUPABASE_SERVICE_ROLE_KEY: it must be the service_role / secret key, not the anon key.`);
  if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(msg)) fail(`Couldn’t reach ${url}. Check NEXT_PUBLIC_SUPABASE_URL and your internet connection.`);
  fail(`Couldn’t create the account: ${msg}`);
}

// Re-running without a name keeps the name already saved.
const { error: staffError } = await admin
  .from('staff')
  .upsert({ user_id: userId, email, role, ...(name ? { name } : {}) }, { onConflict: 'user_id' });
if (staffError) {
  if (/staff/.test(staffError.message) && /(not exist|schema cache|find the table)/i.test(staffError.message)) {
    fail('The account exists, but the store tables are missing. Run supabase/migrations/0001_commerce.sql in the Supabase SQL editor, then run this again.');
  }
  fail(`The account exists, but it couldn’t be made an admin: ${staffError.message}`);
}

console.log(`
✔ ${reset ? 'Password reset and admin access confirmed' : 'Admin account created'} for ${email} (${role}).

  Sign in at: ${siteUrl}/admin/login
`);
