// Renders index.html frame-by-frame with headless Chromium.
//   node render.mjs stills            -> stills/*.jpg + stills/contact-sheet.jpg (one per scene kind)
//   node render.mjs frames 12,300,640  -> stills/debug/f00012.jpg ...
//   node render.mjs video              -> out/promo.mp4 (frames + out/soundtrack.wav)
import { chromium } from 'playwright';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const URL = pathToFileURL(path.join(ROOT, 'index.html')).href + '?render';
const [mode = 'stills', arg] = process.argv.slice(2);

// One still per scene, labelled with its scene kind (DESIGN.md §8).
const STILLS = [
  [30, 's01-slam'], [78, 's02-type-over-data'], [126, 's03-stat'], [178, 's04-type-over-data'],
  [206, 's05a-slam-drop'], [226, 's05b-slam-live'], [276, 's06-device-split'], [358, 's07-device-split'],
  [416, 's08a-ui-closeup'], [466, 's08b-ui-closeup'], [512, 's09a-device-split'], [552, 's09b-device-split'],
  [650, 's10-device-split'], [742, 's11-stat'], [804, 's12-device-trio'], [848, 's13-slam-rapid'],
  [894, 's13b-number-strobe'], [1012, 's14-end-card'],
];

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 30000 });
  return page;
}
async function shoot(page, f, file, type = 'png') {
  await page.evaluate(F => window.seek(F), f);
  await page.screenshot({ path: file, type, ...(type === 'jpeg' ? { quality: 94 } : {}), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
}

const browser = await chromium.launch({ args: ['--disable-gpu', '--force-color-profile=srgb'] });
try {
  if (mode === 'stills' || mode === 'frames') {
    const out = path.join(ROOT, 'stills', mode === 'frames' ? 'debug' : '');
    mkdirSync(out, { recursive: true });
    const list = mode === 'frames' ? arg.split(',').map(n => [+n, 'f' + String(n).padStart(5, '0')]) : STILLS;
    const page = await openPage(browser);
    for (const [f, name] of list) { await shoot(page, f, path.join(out, name + '.jpg'), 'jpeg'); console.log('still', f, name); }
    if (mode === 'stills') {
      const files = list.map(([, n]) => path.join(out, n + '.jpg'));
      const inputs = files.flatMap(f => ['-i', f]);
      const cols = 4, rows = Math.ceil(files.length / cols);
      const filter = files.map((_, i) => `[${i}:v]scale=480:270,drawtext=text='${list[i][1]}':x=10:y=10:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6[v${i}]`).join(';')
        + ';' + files.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${files.length}:layout=${files.map((_, i) => `${(i % cols) * 480}_${Math.floor(i / cols) * 270}`).join('|')}:fill=black[o]`;
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-map', '[o]', '-frames:v', '1', '-q:v', '3', path.join(out, 'contact-sheet.jpg')]);
      console.log('contact sheet', rows, 'rows');
    }
  } else if (mode === 'video') {
    const total = await (await openPage(browser)).evaluate(() => window.TOTAL);
    const dir = path.join(ROOT, 'out', 'frames');
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    const workers = Math.max(1, Math.min(6, os.cpus().length));
    const t0 = Date.now(); let done = 0;
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const page = await openPage(browser);
      for (let f = w; f < total; f += workers) {
        await shoot(page, f, path.join(dir, `${String(f).padStart(5, '0')}.jpg`), 'jpeg');
        if (++done % 100 === 0) console.log(`${done}/${total} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
    }));
    const audio = path.join(ROOT, 'out', 'soundtrack.wav');
    const args = ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(dir, '%05d.jpg')];
    if (existsSync(audio)) args.push('-i', audio, '-c:a', 'aac', '-b:a', '256k', '-shortest');
    args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '14M', '-bufsize', '28M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(ROOT, 'out', 'promo.mp4'));
    execFileSync('ffmpeg', args, { stdio: 'inherit' });
    // Light preview copy for phones / chat apps.
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(ROOT, 'out', 'promo.mp4'), '-vf', 'scale=1280:720', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-maxrate', '6M', '-bufsize', '12M', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', path.join(ROOT, 'out', 'promo-720p.mp4')], { stdio: 'inherit' });
    console.log('wrote out/promo.mp4 + out/promo-720p.mp4 in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  }
} finally {
  await browser.close();
}
