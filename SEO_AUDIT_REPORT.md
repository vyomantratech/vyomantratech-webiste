# SEO Audit Report

**Audit stage:** Repository baseline, before implementation  
**Repository:** VYOMANTRA TECHNOLOGIES  
**Production origin indicated by the existing homepage canonical:** `https://vyomantratech.com/`

## Current SEO status

The repository contains a completed, multi-page English HTML site with PHP-backed forms and career/admin endpoints. It already has page titles and descriptions on most public pages, responsive viewport declarations, a consistent non-`www` HTTPS canonical host on many pages, and no missing image `alt` attributes in the initial static scan. The homepage, service and solution pages, product pages, case studies, careers, courses, legal information, and contact details are present.

The baseline does not have a robots file or sitemap. Structured data is absent. Several pages are missing canonical or description metadata, every page lacks a robots directive, social metadata is incomplete, page metadata is duplicated across route variants, and no image tag has both explicit width and height attributes.

## Repository inventory

- 142 tracked/workspace files were inventoried (excluding `.git` contents).
- 51 HTML documents: 49 public pages and 2 admin pages.
- 4 CSS files, 5 JavaScript files, and 14 PHP files.
- 55 PNG, 4 JPG, and 3 SVG image files.
- No project package manifest or test command was found. Node.js is available; Python and PHP are not available on the current command path.
- The working tree was clean at the start of the audit.

## Technical SEO problems

- No `robots.txt`, `sitemap.xml`, or web manifest exists.
- No JSON-LD or other structured data is present in the HTML.
- No page has a robots meta directive. The two admin pages are not marked `noindex`.
- Open Graph metadata is absent from some pages and incomplete on others; Twitter/X metadata is absent throughout.
- `theme-color` is not present. Existing favicon references are present, but there is no Apple touch icon or manifest.
- All pages use English language metadata and a responsive viewport.
- The home page declares the HTTPS, non-`www` production origin. The repository has no redirect/host configuration, so HTTPS enforcement, HTTP-to-HTTPS redirects, `www` normalization, status codes, headers, caching, and trailing-slash server behavior cannot be verified or configured from the discovered files.
- HTML and scripts reference HTTPS external assets only in the scan; no literal HTTP asset URL was found.
- CSS files are linked as stylesheets in the document head, including Font Awesome from a CDN. Page scripts are generally at the end of the document, with some inline scripts. There is no measured browser trace, Lighthouse result, or deployed Core Web Vitals data in the repository.
- No SearchAction schema is appropriate: the site has no discovered internal search UI.

## Indexing problems

- 49 public documents are candidates for indexing. The two admin documents are private utility/login pages and should be `noindex`.
- Static crawling from `index.html` reaches 43 of the 51 HTML documents. The unreachable set includes the admin dashboard, the Gallery page, several duplicate folder index routes, and legal duplicate routes. Some career detail links are assembled by JavaScript; sitemap discovery can supplement their crawl paths.
- All public pages have exactly one H1 in the baseline; the admin login page has none, which is not an indexing concern once it is marked `noindex`.
- No page was found accidentally marked `noindex`; no current robots file blocks resources.
- Three unresolved local-link matches are JavaScript template placeholders (`${subpageUrl}`), not literal HTML URLs. No deterministic broken local URL was found in the static reference scan.

## Metadata problems

- All 51 documents have a title, but 6 duplicate-title groups exist: portfolio/project pages, product overview pages, service overview pages, solution overview pages, privacy policy copies, and terms copies.
- Six documents have no description: the two admin pages, two byte-identical privacy pages, and two byte-identical terms pages.
- Ten pages lack a canonical element: About, Gallery, the services overview and its folder index, and the two privacy, two terms, and two admin documents.
- Four description-duplicate groups exist among portfolio/projects, products, services, and solutions.
- No robots metadata exists, and Twitter/X fields are absent on all pages. Existing Open Graph fields do not cover every public page and do not consistently include the full set of title, description, URL, type, image, and site name.

## Local SEO problems

- Existing visible company details include the name VYOMANTRA TECHNOLOGIES, an office address in Gopal Colony, Pidamaneri, Dharmapuri, Tamil Nadu 636701, the telephone `+91 81222 88855`, and `vyomantratech@gmail.com`.
- Contact and footer content identify Dharmapuri, Tamil Nadu, India. The contact page includes a Google Maps embed for the business location and phone availability hours; these are not stated as office opening hours.
- These business details are not represented in structured data. Local intent is present on Contact and About, but is not consistently expressed in home-page metadata.
- Three social profile URLs are present in existing site links and can be used as `sameAs` references; they should not be supplemented with unverified profiles.
- No evidence of a second office or nearby branch was found. No additional location pages should be created.

## Structured-data problems

- No Organization, LocalBusiness, WebSite, Service, BreadcrumbList, FAQPage, or review/rating JSON-LD is present.
- The site has no visible internal search feature, and no ratings/reviews markup should be added without eligible visible review data.
- A verified Dharmapuri address, phone, email, map location coordinates, site URL, logo asset, and existing social URLs are available for entity markup. Office hours are not established by the phone availability note.
- Service leaf pages already describe the services and are suitable for factual Service markup. Breadcrumb and FAQ markup must be limited to pages with a matching visible trail or FAQ content.

## Internal-linking problems

- The home page links to the main business sections and there are 3,055 anchor occurrences across the HTML documents.
- Gallery has no static inbound HTML link, despite being a public page.
- The Careers page obtains role cards from PHP/JSON and constructs role links in JavaScript. This is less reliable for static crawl discovery than literal anchors.
- Root `.html` overview pages coexist with corresponding folder `index.html` routes. Privacy and terms each have byte-identical copies. The `projects.html` page already declares the portfolio page as its canonical target.
- Static crawl found no broken local links apart from the three runtime template placeholders noted above. No important page should rely exclusively on those placeholders for discovery.

## Image SEO problems

- The 338 HTML `<img>` tags all have an `alt` attribute in the initial scan. Alt text still requires contextual review; the presence of an attribute alone does not prove its wording is useful.
- None of the 338 image tags has both a declared width and height, creating avoidable layout-shift risk.
- Only 7 lazy-loading attributes were found. The primary above-the-fold image must remain eager; below-the-fold images can be lazy-loaded.
- The repository has 59 raster image files and 3 SVGs, with no WebP or AVIF assets. At least 31 PNG files exceed 500 KB; several photos and 8000×8000 logo variants are large. The production impact depends on which assets each page loads.
- A small existing logo/favicon asset is available; the oversized brand-master artwork should not be used as a page-level logo URL.

## Performance problems

- Missing image dimensions across the site are the clearest statically verifiable CLS risk.
- The common CDN Font Awesome stylesheet is render-blocking in the document head across pages, in addition to local CSS. External font/CDN availability and cache headers are outside the repository.
- Some pages contain inline CSS and inline JavaScript. Existing animation and interaction code is shared across many pages; no dependency removal is recommended without execution-based evidence.
- Numerous high-resolution raster files create optimization opportunities. No image conversion tool was available during the initial inventory, so any format conversion must preserve transparency and visual fidelity.
- LCP, INP, FCP, TTFB, and actual mobile performance cannot be measured from static source alone; no local browser/Lighthouse runtime was identified during this baseline.

## Mobile SEO

- Every HTML document includes a viewport declaration. The site includes responsive CSS rules.
- Actual mobile overflow, touch target sizing, navigation behavior, and rendered breakpoints were not browser-tested during the baseline audit.

## Accessibility issues affecting SEO

- Public HTML pages have one H1 and all image tags include `alt` attributes.
- Only a small subset of pages has a `<main>` landmark. The shared header, navigation, and footer are present broadly; central content landmark coverage should be improved where it can be added without changing layout or behavior.
- Forms and modal/mobile-navigation controls need a focused review for labels, button names, keyboard behavior, and state announcements.
- Static source inspection cannot establish color contrast or keyboard behavior.

## Duplicate content risks

- `privacy.html` and `privacy-policy.html` are byte-identical.
- `terms.html` and `terms-and-conditions.html` are byte-identical.
- `portfolio.html`, `projects.html`, and `portfolio/index.html` share the same title and description; `projects.html` already points to `portfolio.html` as canonical.
- `products.html` / `products/index.html`, `services.html` / `services/index.html`, and `solutions.html` / `solutions/index.html` use duplicated overview metadata and appear to be alternate overview routes.
- No unsupported content rewrites or artificial location pages are indicated.

## Canonical risks

- Ten documents have no canonical. Existing canonical URLs consistently use `https://vyomantratech.com` and never the `www` host in the files scanned.
- Several canonical tags target slash routes while the site also links to `.html` alternatives. There is no server redirect configuration in the repository; HTML canonicals and sitemap selection must therefore agree on one preferred route per duplicate group.
- Canonical consistency for HTTP/HTTPS and host variants cannot be verified without the production server configuration.

## Sitemap problems

- No sitemap exists. Search Console cannot be given a repository-provided sitemap URL.
- The planned sitemap should use absolute HTTPS canonical URLs only and omit admin pages, duplicate aliases, APIs, assets, and development files.

## Robots problems

- No robots file exists. The robots policy should reference the production sitemap and avoid blocking CSS, JavaScript, images, or noindex pages whose robots directive needs to be crawled.
- Private API paths may be disallowed from crawl, but `robots.txt` is not access control. Admin endpoints must remain protected by application/server authorization.

## Security / HTTPS observations

- The HTML and PHP source scan found no literal insecure HTTP asset references. Existing canonical references use HTTPS.
- Server-side HTTPS redirects, TLS configuration, security headers, cookies, and mixed content on deployed pages could not be verified from the repository.
- The static admin login page contains a visible default credential hint. This is a sensitive deployment risk and should be removed from public markup; any corresponding server-side credential must be rotated and protected independently.
- PHP API and admin endpoints exist. Their runtime authorization and response headers require server-side verification; no secrets are included in this report.

## Existing strengths

- Clear brand identity and a canonical production HTTPS host are already present.
- Useful page depth exists for services, solutions, products, client work, careers, courses, contact, and policies.
- The homepage has one H1 and links to the main public navigation areas.
- Contact details and a business map embed are visible and consistent across Contact, About, and the footer.
- Public images currently have `alt` attributes, and responsive viewports are present.
- The form and career pages have server-side endpoints rather than relying solely on client-side submission.

## Recommended improvements

1. Add unique title, description, robots, canonical, Open Graph, Twitter/X, theme-color, and favicon metadata to public documents; mark admin documents `noindex`.
2. Select one canonical URL for each duplicate route group, align internal links and sitemap entries, and retain existing user-facing route behavior.
3. Add root `robots.txt`, an XML sitemap of canonical public URLs, and a small site manifest using existing brand assets.
4. Add Organization and WebSite JSON-LD, LocalBusiness data on the Contact page, and Service data on existing service detail pages using verified facts only.
5. Add a crawlable inbound link to Gallery and static links to existing career detail pages where doing so accurately reflects the visible careers content.
6. Add accurate image dimensions, preserve eager loading for likely LCP imagery, lazy-load below-the-fold images, and reduce image payloads where a safe encoder is available.
7. Improve landmark and form/control accessibility without changing visual design.
8. Validate metadata, links, schema, sitemap, robots, image references, and indexability with a repeatable repository script; verify server redirects, real CWV, and Search Console externally.

## Files planned for modification

- Existing public HTML pages requiring metadata, canonical, social, structured-data, image sizing/loading, or link changes (including `index.html`, `about.html`, `contact.html`, `gallery.html`, overview/detail pages under `services/`, `solutions/`, `products/`, `portfolio/`, `careers/`, and public policy, course, quote, and career pages).
- `admin/index.html` and `admin/dashboard.html` for noindex controls and removal of the visible default credential hint.
- Small icon references only if the existing favicon dimensions and format validate for the proposed manifest.

## Files planned for creation

- `SEO_AUDIT_REPORT.md` (this baseline report).
- `SEO_IMPLEMENTATION_REPORT.md`.
- `SEO_EXTERNAL_ACTIONS.md`.
- `robots.txt`.
- `sitemap.xml`.
- A dependency-free `scripts/seo-audit.mjs` validation utility.
- A root web manifest if the existing logo/favicon asset is suitable.

