# SEO External Actions

These actions require access to external search, business, analytics, hosting, or browser environments and were not performed from this repository.

## Google Search Console

1. Verify the `vyomantratech.com` domain property (DNS verification is preferred when available).
2. Submit `https://vyomantratech.com/sitemap.xml` under **Sitemaps**.
3. Inspect the homepage, Contact, main service pages, and important project pages with URL Inspection. Check Google's selected canonical and rendered HTML.
4. Monitor indexing, duplicate/canonical reports, crawl stats, mobile usability where reported, and Core Web Vitals. Resolve issues based on live data; sitemap submission does not guarantee indexing.

## Google Business Profile

1. Claim or verify the existing eligible business profile using the real-world business name and actual operating location/service model.
2. Match the website's verified name, Dharmapuri address, phone, and website URL. Only configure service areas that the business genuinely serves and complies with Google's current eligibility rules.
3. Enter office opening hours only after confirming them; phone availability hours on the website are not necessarily office hours.
4. Keep the profile accurate and request feedback without incentives or review manipulation. Do not create duplicate profiles or fake branches.

## Bing Webmaster Tools

Verify the website, submit `https://vyomantratech.com/sitemap.xml`, and review crawl/indexing diagnostics and search performance.

## Analytics and measurement

No analytics/search console integration was identified in the repository. If analytics is needed, select and configure a privacy-compliant analytics product, consent behavior where required, retention, and access controls. Keep Search Console as the source for Google organic search impressions/clicks.

## Business identity and citations

- Audit any existing social profiles and business listings so the official business name, website, phone, and address match the real business and this website.
- Maintain only legitimate, relevant local and industry directory listings; correct outdated records and duplicates.
- Ask real clients for permission before naming or linking to them or publishing project references. Seek editorially earned links from relevant partners, clients, and industry organizations.
- Do not buy links, use PBNs, submit to spam directories, automate backlink creation, or fabricate reviews or business details.

## Hosting, security, and admin

- Verify production redirects to HTTPS and the non-`www` host; check that canonical routes resolve with the expected status and do not redirect in loops.
- Check TLS, mixed content, response headers, cache policy, compression, and uptime on the deployed site.
- Verify admin/API authentication and authorization server-side. Rotate any default/previously exposed admin credential and check server configuration before deployment. `robots.txt` and `noindex` are not access controls.
- Ensure uploads, resumes, logs, and private/admin paths cannot be served publicly unless intended; check access rules on the live server.

## Browser and performance QA

- Test all forms and API paths in staging/production, including validation and error states.
- Check mobile navigation, viewport overflow, focus order, reduced-motion behavior, form labels, and visual contrast on real browser/device sizes.
- Run Lighthouse/PageSpeed Insights and field Core Web Vitals after deployment; optimize using measured LCP, INP, CLS, FCP, and TTFB data.
- Review browser console/network errors and verify third-party font/icon delivery.

## Ongoing monitoring

Track branded and non-branded impressions, clicks, landing pages, local discovery, conversion events, crawl/indexing exclusions, Core Web Vitals, and real referral links. Review changes over time; no ranking or indexing outcome is guaranteed by repository changes alone.
