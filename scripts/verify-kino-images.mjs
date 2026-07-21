import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseKinoquiz = createClient(supabaseUrl, supabaseKey, { db: { schema: 'kinoquiz' } });

const outDir = path.join(process.cwd(), 'public', 'kino-images');
const mapFile = path.join(process.cwd(), 'src', 'generated', 'kino-image-map.json');

async function run() {
  let hasError = false;
  const logError = (msg) => {
    console.error(`[ERROR] ${msg}`);
    hasError = true;
  };

  let map;
  try {
    map = JSON.parse(await fs.readFile(mapFile, 'utf8'));
  } catch (err) {
    logError('Cannot read kino-image-map.json');
    process.exit(1);
  }

  // Check map for duplicates
  const localPaths = new Set();
  for (const [url, localPath] of Object.entries(map)) {
    if (!localPath.startsWith('/kino-images/')) {
      logError(`Local path is outside /kino-images/: ${localPath}`);
    }
    if (localPaths.has(localPath)) {
      logError(`Duplicate local path in map: ${localPath}`);
    }
    localPaths.add(localPath);

    const fullPath = path.join(process.cwd(), 'public', localPath);
    if (!existsSync(fullPath)) {
      logError(`File from map is missing: ${localPath} for URL ${url}`);
    } else {
      const stat = await fs.stat(fullPath);
      if (stat.size === 0) {
        logError(`File is empty: ${localPath}`);
      }
      
      const ext = path.extname(fullPath).toLowerCase();
      // We assume extensions are correct based on download script, but can't fully verify content-type without reading magic bytes.
      // At least we check if it has a valid extension
      if (!['.jpg', '.png', '.webp', '.avif', '.gif', '.jpeg'].includes(ext)) {
        logError(`Invalid extension: ${ext} for ${localPath}`);
      }
    }
  }

  // Get all URLs from DB
  const urls = new Set();
  const processUrl = (urlStr) => {
    if (!urlStr) return;
    try {
      new URL(urlStr);
      urls.add(urlStr);
    } catch {}
  };

  const { data: d1 } = await supabase.from('kinokadr_movies').select('image_url');
  if (d1) d1.forEach(r => processUrl(r.image_url));

  const { data: d2 } = await supabase.from('kinoquiz_questions').select('image_url');
  if (d2) d2.forEach(r => processUrl(r.image_url));

  const { data: d3 } = await supabaseKinoquiz.from('questions').select('image_url');
  if (d3) d3.forEach(r => processUrl(r.image_url));

  let missingInMap = 0;
  for (const url of urls) {
    if (!map[url]) {
      logError(`URL from DB is missing in map: ${url}`);
      missingInMap++;
    }
  }

  if (hasError) {
    console.error('Verification failed.');
    process.exit(1);
  } else {
    console.log(`Verification passed. Total unique URLs checked: ${urls.size}`);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
