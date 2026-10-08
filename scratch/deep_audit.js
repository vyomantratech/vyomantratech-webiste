const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Read all HTML files
function getHtmlFiles(dir, list = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (item !== '.git' && item !== 'node_modules') {
        getHtmlFiles(full, list);
      }
    } else if (item.endsWith('.html')) {
      list.push(full);
    }
  }
  return list;
}

const htmlFiles = getHtmlFiles(ROOT_DIR);

const auditResults = [];

htmlFiles.forEach(file => {
  const relPath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  // Title
  const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Meta description
  const metaDescMatch = content.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i) ||
                        content.match(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i);
  const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : null;

  // Canonical
  const canonicalMatch = content.match(/<link\s+rel=["']canonical["']\s+href=["']([\s\S]*?)["']/i) ||
                         content.match(/<link\s+href=["']([\s\S]*?)["']\s+rel=["']canonical["']/i);
  const canonical = canonicalMatch ? canonicalMatch[1].trim() : null;

  // Robots meta
  const robotsMetaMatch = content.match(/<meta\s+name=["']robots["']\s+content=["']([\s\S]*?)["']/i) ||
                          content.match(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']robots["']/i);
  const robotsMeta = robotsMetaMatch ? robotsMetaMatch[1].trim() : null;

  // Viewport
  const viewportMatch = content.match(/<meta\s+name=["']viewport["']\s+content=["']([\s\S]*?)["']/i);
  const viewport = viewportMatch ? viewportMatch[1].trim() : null;

  // Headings
  const h1Matches = [...content.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
  const h2Matches = [...content.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
  const h3Matches = [...content.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());

  // JSON-LD scripts
  const jsonLdScripts = [];
  const scriptRegex = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(content)) !== null) {
    const raw = match[1].trim();
    try {
      const parsed = JSON.parse(raw);
      jsonLdScripts.push({ valid: true, data: parsed, raw });
    } catch (e) {
      jsonLdScripts.push({ valid: false, error: e.message, raw });
    }
  }

  // OG tags
  const ogTitle = (content.match(/<meta\s+property=["']og:title["']\s+content=["']([\s\S]*?)["']/i) || [])[1] || null;
  const ogDesc = (content.match(/<meta\s+property=["']og:description["']\s+content=["']([\s\S]*?)["']/i) || [])[1] || null;
  const ogUrl = (content.match(/<meta\s+property=["']og:url["']\s+content=["']([\s\S]*?)["']/i) || [])[1] || null;
  const ogImage = (content.match(/<meta\s+property=["']og:image["']\s+content=["']([\s\S]*?)["']/i) || [])[1] || null;
  const ogType = (content.match(/<meta\s+property=["']og:type["']\s+content=["']([\s\S]*?)["']/i) || [])[1] || null;
  const ogSiteName = (content.match(/<meta\s+property=["']og:site_name["']\s+content=["']([\s\S]*?)["']/i) || [])[1] || null;

  // Twitter tags
  const twCard = (content.match(/<meta\s+name=["']twitter:card["']\s+content=["']([\s\S]*?)["']/i) || [])[1] || null;
  const twTitle = (content.match(/<meta\s+name=["']twitter:title["']\s+content=["']([\s\S]*?)["']/i) || [])[1] || null;
  const twDesc = (content.match(/<meta\s+name=["']twitter:description["']\s+content=["']([\s\S]*?)["']/i) || [])[1] || null;
  const twImage = (content.match(/<meta\s+name=["']twitter:image["']\s+content=["']([\s\S]*?)["']/i) || [])[1] || null;

  // Images
  const imgRegex = /<img\s+([^>]+)>/gi;
  const images = [];
  let imgMatch;
  while ((imgMatch = imgRegex.exec(content)) !== null) {
    const attrs = imgMatch[1];
    const src = (attrs.match(/src=["']([\s\S]*?)["']/i) || [])[1] || '';
    const alt = (attrs.match(/alt=["']([\s\S]*?)["']/i) || [])[1]; // undefined if no alt attr
    const loading = (attrs.match(/loading=["']([\s\S]*?)["']/i) || [])[1] || null;
    const width = (attrs.match(/width=["']([\s\S]*?)["']/i) || [])[1] || null;
    const height = (attrs.match(/height=["']([\s\S]*?)["']/i) || [])[1] || null;
    images.push({ src, alt, loading, width, height });
  }

  // Links
  const linkRegex = /<a\s+([^>]+)>/gi;
  const links = [];
  let aMatch;
  while ((aMatch = linkRegex.exec(content)) !== null) {
    const attrs = aMatch[1];
    const href = (attrs.match(/href=["']([\s\S]*?)["']/i) || [])[1] || '';
    const text = ''; // can grab if needed
    links.push({ href });
  }

  // Brand strings count in raw content (strip scripts/styles if possible or in body)
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyText = bodyMatch ? bodyMatch[1] : content;
  
  const brandStats = {
    vyomantraTechCaps: (content.match(/VYOMANTRA TECHNOLOGIES/g) || []).length,
    vyomantraTechMixed: (content.match(/Vyomantra Technologies/g) || []).length,
    vyomastra: (content.match(/Vyomastra/gi) || []).length,
    mindkraft: (content.match(/Mind\s*Kraft/gi) || []).length,
    vyomantraCaps: (content.match(/VYOMANTRA/g) || []).length,
    vyomantraMixed: (content.match(/Vyomantra/g) || []).length,
  };

  auditResults.push({
    file: relPath,
    title,
    metaDescription,
    canonical,
    robotsMeta,
    viewport,
    h1: h1Matches,
    h2Count: h2Matches.length,
    h3Count: h3Matches.length,
    jsonLdCount: jsonLdScripts.length,
    jsonLdScripts,
    og: { ogTitle, ogDesc, ogUrl, ogImage, ogType, ogSiteName },
    twitter: { twCard, twTitle, twDesc, twImage },
    imagesCount: images.length,
    imagesMissingAlt: images.filter(img => img.alt === undefined).length,
    imagesEmptyAlt: images.filter(img => img.alt === '').length,
    imagesLazyCount: images.filter(img => img.loading === 'lazy').length,
    images,
    linksCount: links.length,
    links,
    brandStats
  });
});

fs.writeFileSync(path.join(__dirname, 'html_audit_raw.json'), JSON.stringify(auditResults, null, 2));
console.log(`Audited ${auditResults.length} HTML files successfully.`);
