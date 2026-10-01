#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://vyomantratech.com';
const errors = [];
const warnings = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules') return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2] ?? '';
}

function decode(value) {
  return value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}

function check(ok, message) {
  if (!ok) errors.push(message);
}

function documentUrl(file) {
  const rel = relative(file);
  if (rel === 'index.html') return `${origin}/`;
  if (rel.endsWith('/index.html')) return `${origin}/${rel.slice(0, -'index.html'.length)}`;
  return `${origin}/${rel}`;
}

function resolveLocal(fromFile, reference) {
  if (!reference || /^(?:#|javascript:|mailto:|tel:|data:|blob:)/i.test(reference) || reference.includes('${')) return null;
  let url;
  try {
    url = new URL(reference, `${origin}/${relative(fromFile)}`);
  } catch {
    return { error: `invalid URL ${reference}` };
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (url.protocol === 'http:' && url.hostname === 'vyomantratech.com') return { error: `insecure internal URL ${reference}` };
  if (!['vyomantratech.com', 'www.vyomantratech.com'].includes(url.hostname)) return null;
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return { error: `invalid path encoding ${reference}` }; }
  const diskPath = path.resolve(root, `.${pathname}`);
  if (!diskPath.startsWith(root + path.sep) && diskPath !== root) return { error: `path escapes repository ${reference}` };
  const candidates = [diskPath];
  if (pathname.endsWith('/')) candidates.push(path.join(diskPath, 'index.html'));
  else if (!path.extname(diskPath)) candidates.push(`${diskPath}.html`, path.join(diskPath, 'index.html'));
  const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  return found ? { file: found, fragment: url.hash.slice(1) } : { error: `missing local target ${reference}` };
}

function imageDimensions(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.webp') {
    const data = fs.readFileSync(file);
    const chunk = data.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && data.length >= 30) return [data.readUIntLE(24, 3) + 1, data.readUIntLE(27, 3) + 1];
    if (chunk === 'VP8L' && data.length >= 25 && data[20] === 0x2f) {
      const bits = data.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    if (chunk === 'VP8 ' && data.length >= 30 && data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a) {
      return [data.readUInt16LE(26) & 0x3fff, data.readUInt16LE(28) & 0x3fff];
    }
  }
  const data = fs.readFileSync(file);
  if (ext === '.png' && data.length >= 24) return [data.readUInt32BE(16), data.readUInt32BE(20)];
  if (ext === '.jpg' || ext === '.jpeg') {
    let index = 2;
    while (index < data.length) {
      if (data[index] !== 0xff) { index += 1; continue; }
      const marker = data[index + 1];
      index += 2;
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = data.readUInt16BE(index);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return [data.readUInt16BE(index + 5), data.readUInt16BE(index + 3)];
      index += length;
    }
  }
  if (ext === '.svg') {
    const svg = data.toString('utf8');
    const viewBox = svg.match(/viewBox=["']\s*[\d.-]+[ ,]+[\d.-]+[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
    if (viewBox) return [Number(viewBox[1]), Number(viewBox[2])];
  }
  return null;
}

const files = walk(root);
const htmlFiles = files.filter((file) => file.toLowerCase().endsWith('.html'));
const pageData = new Map();
const titleGroups = new Map();
const descriptionGroups = new Map();
let jsonLdCount = 0;
let imageCount = 0;
let imageWithoutAlt = 0;
let imageWithoutDimensions = 0;
let imageDimensionMismatches = 0;
let internalLinkCount = 0;
let brokenLinks = 0;
let externalHttpRefs = 0;
let ogFieldPages = 0;
let twitterFieldPages = 0;

for (const file of htmlFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const rel = relative(file);
  const robots = source.match(/<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] ?? '';
  const noindex = /\bnoindex\b/i.test(robots);
  const title = decode(source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().replace(/\s+/g, ' ') ?? '');
  const description = decode(source.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] ?? '');
  const canonicals = [...source.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*>/ig)].map((match) => attr(match[0], 'href'));
  const canonical = canonicals[0] ?? '';
  const indexable = !noindex;
  const data = { file, rel, source, title, description, robots, noindex, canonical, indexable };
  pageData.set(file, data);

  check(Boolean(title), `${rel}: missing title`);
  check(Boolean(robots), `${rel}: missing robots meta`);
  if (rel.startsWith('admin/')) check(noindex, `${rel}: admin page is not noindex`);
  if (indexable) {
    check(description.length > 0, `${rel}: missing meta description`);
    check(canonicals.length === 1, `${rel}: expected one canonical, found ${canonicals.length}`);
    if (canonical) check(canonical.startsWith(`${origin}/`), `${rel}: canonical is outside the production origin`);
    const h1Count = [...source.matchAll(/<h1\b/ig)].length;
    check(h1Count === 1, `${rel}: expected one H1, found ${h1Count}`);
    const mainCount = [...source.matchAll(/<main\b/ig)].length;
    check(mainCount === 1, `${rel}: expected one main landmark, found ${mainCount}`);
    check(/<html\b[^>]*\blang=["']en(?:-[A-Za-z-]+)?["']/i.test(source), `${rel}: missing English language metadata`);
    check(/<meta\b[^>]*name=["']viewport["']/i.test(source), `${rel}: missing mobile viewport metadata`);
    for (const field of ['og:title', 'og:description', 'og:url', 'og:type', 'og:site_name', 'og:image']) check(new RegExp(`property=["']${field}["']`, 'i').test(source), `${rel}: missing ${field}`);
    for (const field of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) check(new RegExp(`name=["']${field}["']`, 'i').test(source), `${rel}: missing ${field}`);
    ogFieldPages += /property=["']og:image["']/i.test(source) ? 1 : 0;
    twitterFieldPages += /name=["']twitter:image["']/i.test(source) ? 1 : 0;
    if ((titleGroups.get(title) ?? []).length) warnings.push(`${rel}: duplicate title "${title}"`);
    titleGroups.set(title, [...(titleGroups.get(title) ?? []), rel]);
    if (description) {
      if ((descriptionGroups.get(description) ?? []).length) warnings.push(`${rel}: duplicate description`);
      descriptionGroups.set(description, [...(descriptionGroups.get(description) ?? []), rel]);
    }
    if (title.length > 70) warnings.push(`${rel}: title is ${title.length} characters`);
    if (description.length > 170) warnings.push(`${rel}: description is ${description.length} characters`);
  }

  const ids = new Set([...source.matchAll(/\bid=["']([^"']+)["']/ig)].map((match) => decode(match[1])));
  for (const match of source.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/ig)) {
    try { JSON.parse(match[1]); jsonLdCount += 1; }
    catch (error) { errors.push(`${rel}: malformed JSON-LD (${error.message})`); }
  }

  for (const match of source.matchAll(/<(?:a|link|script|img|source|iframe|form)\b[^>]*>/ig)) {
    const tag = match[0];
    const tagName = tag.match(/^<(\w+)/)?.[1]?.toLowerCase();
    const name = tagName === 'a' || tagName === 'link' ? 'href' : tagName === 'form' ? 'action' : 'src';
    const refs = [attr(tag, name)].filter(Boolean);
    if (tagName === 'source' || tagName === 'img') refs.push(...(attr(tag, 'srcset') ? attr(tag, 'srcset').split(',').map((item) => item.trim().split(/\s+/)[0]) : []));
    if (tagName === 'a' && !attr(tag, 'alt') && /\btarget=["']_blank["']/i.test(tag) && !/\brel=["'][^"']*noopener/i.test(tag)) warnings.push(`${rel}: target=_blank link should include rel=noopener`);
    for (const ref of refs) {
      if (/^http:\/\//i.test(ref)) externalHttpRefs += 1;
      const resolved = resolveLocal(file, ref);
      if (!resolved) continue;
      if (resolved.error) { brokenLinks += 1; errors.push(`${rel}: ${resolved.error}`); continue; }
      internalLinkCount += 1;
      if (resolved.fragment) {
        const target = pageData.get(resolved.file) ?? { source: fs.readFileSync(resolved.file, 'utf8') };
        const targetIds = new Set([...target.source.matchAll(/\bid=["']([^"']+)["']/ig)].map((id) => decode(id[1])));
        if (!targetIds.has(decode(resolved.fragment))) { brokenLinks += 1; errors.push(`${rel}: missing fragment #${resolved.fragment} in ${relative(resolved.file)}`); }
      }
    }
  }

  for (const image of source.matchAll(/<img\b[^>]*>/ig)) {
    imageCount += 1;
    const tag = image[0];
    if (!/\balt\s*=/i.test(tag)) imageWithoutAlt += 1;
    const src = attr(tag, 'src');
    const resolved = src ? resolveLocal(file, src) : null;
    if (src && resolved?.file) {
      const size = imageDimensions(resolved.file);
      const width = Number(attr(tag, 'width'));
      const height = Number(attr(tag, 'height'));
      if (size && (!width || !height)) imageWithoutDimensions += 1;
      if (size && width && height && (width !== size[0] || height !== size[1])) {
        imageDimensionMismatches += 1;
        errors.push(`${rel}: declared image dimensions ${width}x${height} do not match ${size[0]}x${size[1]} for ${src}`);
      }
    }
  }
}

for (const file of files.filter((item) => item.toLowerCase().endsWith('.css'))) {
  const css = fs.readFileSync(file, 'utf8');
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/ig)) {
    const ref = match[1].trim();
    if (/^(?:data:|https?:|#|var\()/i.test(ref)) continue;
    const resolved = resolveLocal(file, ref);
    if (resolved?.error) errors.push(`${relative(file)}: ${resolved.error}`);
  }
}

const indexablePages = [...pageData.values()].filter((item) => item.indexable);
const reachable = new Set(['index.html']);
const queue = ['index.html'];
while (queue.length) {
  const current = queue.shift();
  const page = pageData.get(path.resolve(root, current));
  if (!page) continue;
  for (const match of page.source.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/ig)) {
    const resolved = resolveLocal(page.file, match[1]);
    if (resolved?.file && pageData.has(resolved.file) && !pageData.get(resolved.file).noindex) {
      const target = relative(resolved.file);
      if (!reachable.has(target)) { reachable.add(target); queue.push(target); }
    }
  }
}
const orphans = indexablePages.filter((page) => page.canonical === documentUrl(page.file) && !reachable.has(page.rel)).map((page) => page.rel);
if (orphans.length) warnings.push(`Canonical pages with no static inbound path from the homepage: ${orphans.join(', ')}`);

const robotsPath = path.join(root, 'robots.txt');
check(fs.existsSync(robotsPath), 'robots.txt is missing');
if (fs.existsSync(robotsPath)) {
  const robots = fs.readFileSync(robotsPath, 'utf8');
  check(new RegExp(`^Sitemap:\\s*${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/sitemap\\.xml\\s*$`, 'im').test(robots), 'robots.txt does not reference the production sitemap');
  check(!/^Disallow:\s*\/(?:css|js|assets)(?:\/|\s|$)/im.test(robots), 'robots.txt blocks render assets');
}

const sitemapPath = path.join(root, 'sitemap.xml');
check(fs.existsSync(sitemapPath), 'sitemap.xml is missing');
if (fs.existsSync(sitemapPath)) {
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  check(/<urlset\b[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/.test(xml), 'sitemap.xml is missing the sitemap namespace');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  check(urls.length === new Set(urls).size, 'sitemap.xml contains duplicate URLs');
  for (const url of urls) check(url.startsWith(`${origin}/`), `sitemap URL is not canonical HTTPS: ${url}`);
  const canonicals = new Set(indexablePages.map((page) => page.canonical).filter(Boolean));
  const listed = new Set(urls);
  for (const url of canonicals) check(listed.has(url), `canonical page is missing from sitemap: ${url}`);
  for (const url of listed) check(canonicals.has(url), `sitemap contains a URL without an indexable canonical page: ${url}`);
}

const apiPhpFiles = files.filter((file) => relative(file).startsWith('api/') && file.toLowerCase().endsWith('.php'));
for (const file of apiPhpFiles) check(/header\s*\(\s*['"]X-Robots-Tag:\s*noindex,\s*nofollow['"]/i.test(fs.readFileSync(file, 'utf8')), `${relative(file)}: missing noindex response header`);

const result = {
  htmlDocuments: htmlFiles.length,
  indexableDocuments: indexablePages.length,
  noindexDocuments: [...pageData.values()].filter((page) => page.noindex).length,
  sitemapUrls: fs.existsSync(sitemapPath) ? [...fs.readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].length : 0,
  staticInternalReferences: internalLinkCount,
  brokenInternalReferences: brokenLinks,
  imageTags: imageCount,
  imagesWithMissingAlt: imageWithoutAlt,
  localImagesWithMissingDimensions: imageWithoutDimensions,
  localImageDimensionMismatches: imageDimensionMismatches,
  openGraphPages: ogFieldPages,
  twitterPages: twitterFieldPages,
  jsonLdBlocks: jsonLdCount,
  apiPhpResponsesMarkedNoindex: apiPhpFiles.length,
  canonicalOrphans: orphans,
  errors,
  warnings,
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
