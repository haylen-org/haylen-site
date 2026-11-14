const jsonForHtml = (value) =>
  JSON.stringify(value).replace(
    /[<>&]/g,
    (character) => ({ '<': '\\u003c', '>': '\\u003e', '&': '\\u0026' })[character],
  );

export function validateSite(site, image) {
  const origin = new URL(site.url);
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error('Site URL must be an HTTPS origin without a path, query or credentials');
  for (const key of ['name', 'description', 'repository', 'socialImageAlt']) {
    if (typeof site[key] !== 'string' || !site[key].trim()) throw new Error(`Missing site ${key}`);
  }
  if (site.socialImage !== 'assets/og-cover.png') throw new Error('Expected the local PNG social cover');
  if (image.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error('Social cover must be a PNG');
  return {
    ...site,
    url: origin.origin,
    imageWidth: image.readUInt32BE(16),
    imageHeight: image.readUInt32BE(20),
  };
}

export function pageSeo(site, page, title, description) {
  const canonical = `${site.url}${page === 'home' ? '/' : `/${page}/`}`;
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${site.url}/#organization`,
      name: 'Haylen',
      url: `${site.url}/`,
      logo: `${site.url}/favicon.svg`,
      sameAs: [site.repository],
    },
    {
      '@type': 'WebSite',
      '@id': `${site.url}/#website`,
      name: site.name,
      url: `${site.url}/`,
      description: site.description,
      inLanguage: 'en',
      publisher: { '@id': `${site.url}/#organization` },
    },
    {
      '@type': { home: 'WebPage', about: 'AboutPage', demos: 'CollectionPage' }[page],
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      inLanguage: 'en',
      isPartOf: { '@id': `${site.url}/#website` },
      about: { '@id': `${site.url}/#engine` },
      ...(page !== 'home' ? { breadcrumb: { '@id': `${canonical}#breadcrumb` } } : {}),
    },
    {
      '@type': 'SoftwareSourceCode',
      '@id': `${site.url}/#engine`,
      name: 'Haylen',
      description: site.description,
      url: `${site.url}/`,
      codeRepository: site.repository,
      programmingLanguage: ['C++', 'Lua'],
      license: 'https://opensource.org/license/mit',
    },
  ];
  if (page !== 'home')
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${site.url}/` },
        { '@type': 'ListItem', position: 2, name: page === 'about' ? 'About' : 'Demos', item: canonical },
      ],
    });
  return {
    CANONICAL: canonical,
    CANONICAL_LINK: `<link rel="canonical" href="${canonical}" />`,
    ROBOTS: 'index, follow, max-image-preview:large',
    STRUCTURED_DATA: `<script type="application/ld+json">${jsonForHtml({ '@context': 'https://schema.org', '@graph': graph })}</script>`,
  };
}

export function sitemap(site, pages) {
  const urls = pages.map(([page]) => `${site.url}${page === 'home' ? '/' : `/${page}/`}`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`;
}
