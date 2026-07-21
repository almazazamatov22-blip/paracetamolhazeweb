import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import https from 'https';
import http from 'http';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseKinoquiz = createClient(supabaseUrl, supabaseKey, { db: { schema: 'kinoquiz' } });

const outDir = path.join(process.cwd(), 'public', 'kino-images');
const mapFile = path.join(process.cwd(), 'src', 'generated', 'kino-image-map.json');

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode !== 200) {
        req.destroy();
        return reject(new Error(`Status ${res.statusCode}`));
      }
      const contentType = res.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        req.destroy();
        return reject(new Error(`Invalid content type ${contentType}`));
      }
      
      let ext = '.jpg';
      if (contentType.includes('png')) ext = '.png';
      else if (contentType.includes('webp')) ext = '.webp';
      else if (contentType.includes('avif')) ext = '.avif';
      else if (contentType.includes('gif')) ext = '.gif';

      const finalPath = destPath + ext;

      if (existsSync(finalPath)) {
        req.destroy();
        return resolve(finalPath);
      }

      const fileStream = createWriteStream(finalPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close((err) => {
          if (err) reject(err);
          else resolve(finalPath);
        });
      });

      fileStream.on('error', (err) => {
        fs.unlink(finalPath).catch(() => {});
        reject(err);
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function retryDownload(url, destBase, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const finalPath = await downloadFile(url, destBase);
      const stat = await fs.stat(finalPath);
      if (stat.size === 0) {
        await fs.unlink(finalPath);
        throw new Error('0 bytes file');
      }
      return finalPath;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function run() {
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(path.dirname(mapFile), { recursive: true });

  const urls = new Set();
  const sourceStats = {
    kinokadr_movies: { rows: 0, nonNullUrls: 0, unique: 0, invalid: 0 },
    public_kinoquiz_questions: { rows: 0, nonNullUrls: 0, unique: 0, invalid: 0 },
    kinoquiz_questions: { rows: 0, nonNullUrls: 0, unique: 0, invalid: 0 }
  };

  const processUrl = (urlStr, sourceKey) => {
    if (!urlStr) return;
    sourceStats[sourceKey].nonNullUrls++;
    try {
      new URL(urlStr);
      urls.add(urlStr);
      sourceStats[sourceKey].unique = urls.size;
    } catch {
      sourceStats[sourceKey].invalid++;
    }
  };

  try {
    const { data: d1, error: e1 } = await supabase.from('kinokadr_movies').select('image_url');
    if (!e1 && d1) {
      sourceStats.kinokadr_movies.rows = d1.length;
      d1.forEach(r => processUrl(r.image_url, 'kinokadr_movies'));
    }
  } catch(e) {}

  try {
    const { data: d2, error: e2 } = await supabase.from('kinoquiz_questions').select('image_url');
    if (!e2 && d2) {
      sourceStats.public_kinoquiz_questions.rows = d2.length;
      d2.forEach(r => processUrl(r.image_url, 'public_kinoquiz_questions'));
    }
  } catch(e) {}

  try {
    const { data: d3, error: e3 } = await supabaseKinoquiz.from('questions').select('image_url');
    if (!e3 && d3) {
      sourceStats.kinoquiz_questions.rows = d3.length;
      d3.forEach(r => processUrl(r.image_url, 'kinoquiz_questions'));
    }
  } catch(e) {}

  console.log('--- AUDIT REPORT ---');
  console.log(JSON.stringify(sourceStats, null, 2));

  let map = {};
  if (existsSync(mapFile)) {
    try {
      map = JSON.parse(await fs.readFile(mapFile, 'utf8'));
    } catch(e) {}
  }

  let success = 0;
  let failed = 0;
  const arrUrls = Array.from(urls);
  
  // Clean map keys that don't map to anything existing
  for (const [k, v] of Object.entries(map)) {
    if (!existsSync(path.join(process.cwd(), 'public', v))) {
      delete map[k];
    }
  }

  const batchSize = 20;
  for (let i = 0; i < arrUrls.length; i += batchSize) {
    const batch = arrUrls.slice(i, i + batchSize);
    await Promise.all(batch.map(async (url) => {
      const hash = crypto.createHash('sha256').update(url).digest('hex');
      const baseDest = path.join(outDir, hash);
      
      // if already in map and file exists, skip
      if (map[url]) {
        if (existsSync(path.join(process.cwd(), 'public', map[url]))) {
          success++;
          return;
        }
      }

      try {
        const finalPath = await retryDownload(url, baseDest);
        const fileName = path.basename(finalPath);
        map[url] = `/kino-images/${fileName}`;
        success++;
      } catch (err) {
        failed++;
        console.error(`Failed to download ${url}:`, err.message);
      }
    }));
    
    if (i % 100 === 0) {
      console.log(`Progress: ${i}/${arrUrls.length}`);
      await fs.writeFile(mapFile, JSON.stringify(map, null, 2));
    }
  }

  await fs.writeFile(mapFile, JSON.stringify(map, null, 2));
  
  console.log(`\nDownload complete: ${success} success, ${failed} failed.`);

  // Calculate size
  const files = await fs.readdir(outDir);
  let totalSize = 0;
  let max = 0;
  let min = Infinity;
  for (const f of files) {
    const s = await fs.stat(path.join(outDir, f));
    totalSize += s.size;
    if (s.size > max) max = s.size;
    if (s.size < min) min = s.size;
  }
  
  console.log('--- SIZE REPORT ---');
  console.log(`Files count: ${files.length}`);
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Min size: ${(min / 1024).toFixed(2)} KB`);
  console.log(`Max size: ${(max / 1024).toFixed(2)} KB`);
  console.log(`Avg size: ${((totalSize / files.length) / 1024).toFixed(2)} KB`);
}

run().catch(console.error);
