import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseKinoquiz = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'kinoquiz' } });

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
    process.exitCode = 1;
    return;
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
      if (!['.jpg', '.png', '.webp', '.avif', '.gif', '.jpeg'].includes(ext)) {
        logError(`Invalid extension: ${ext} for ${localPath}`);
      }

      // Check magic bytes
      const buffer = await fs.readFile(fullPath);
      let isValidSignature = false;
      if (buffer.length > 4) {
        if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) isValidSignature = true; // JPEG
        else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) isValidSignature = true; // PNG
        else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) isValidSignature = true; // WebP
        else if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) isValidSignature = true; // AVIF/HEIC/MP4 container
        else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) isValidSignature = true; // GIF
      }
      
      if (!isValidSignature) {
        logError(`Invalid file signature (magic bytes) for ${localPath}`);
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

  const { data: d1, error: e1 } = await supabase.from('kinokadr_movies').select('image_url');
  if (e1) {
    logError(`kinokadr_movies fetch failed: ${e1.message}`);
  } else if (d1) d1.forEach(r => processUrl(r.image_url));

  const { data: d2, error: e2 } = await supabase.from('kinoquiz_questions').select('image_url');
  if (e2) {
    logError(`kinoquiz_questions fetch failed: ${e2.message}`);
  } else if (d2) d2.forEach(r => processUrl(r.image_url));

  const { data: d3, error: e3 } = await supabaseKinoquiz.from('questions').select('image_url');
  if (e3) {
    logError(`kinoquiz.questions fetch failed: ${e3.message}`);
  } else if (d3) d3.forEach(r => processUrl(r.image_url));

  const fallbackUrls = [
    'https://image.tmdb.org/t/p/w1280/8IB2e4r4oVhHnANbnm7O3Tj6tF8.jpg',
    'https://image.tmdb.org/t/p/w1280/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    'https://image.tmdb.org/t/p/w1280/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    'https://image.tmdb.org/t/p/w1280/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
    'https://image.tmdb.org/t/p/w1280/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg'
  ];
  fallbackUrls.forEach(url => processUrl(url));

  let missingInMap = 0;
  for (const url of urls) {
    if (!map[url]) {
      logError(`URL from DB is missing in map: ${url}`);
      missingInMap++;
    }
  }

  if (hasError) {
    console.error('Verification failed.');
    process.exitCode = 1;
  } else {
    console.log(`Verification passed. Total unique URLs checked: ${urls.size}`);
  }
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
