/** Cache tags and paths that a change to an entity invalidates (backend-plan 6.1.7). */
export interface TagSet {
  tags: string[];
  paths: string[];
}

export function tagsFor(entity: string, slug?: string | null, extra: string[] = []): TagSet {
  const tags = new Set<string>(extra);
  const paths = new Set<string>();
  switch (entity) {
    case 'product':
      tags.add('products').add('sitemap').add('hero').add('page:home');
      if (slug) tags.add(`product:${slug}`);
      paths.add('/products');
      if (slug) paths.add(`/products/${slug}`);
      break;
    case 'product-category':
      tags.add('categories').add('products').add('sitemap');
      paths.add('/products');
      break;
    case 'brand':
      tags.add('brands').add('products').add('sitemap').add('page:home');
      if (slug) tags.add(`brand:${slug}`);
      paths.add('/brands');
      if (slug) paths.add(`/brands/${slug}`);
      break;
    case 'service':
      tags.add('services').add('sitemap').add('page:home');
      if (slug) tags.add(`service:${slug}`);
      paths.add('/services');
      if (slug) paths.add(`/services/${slug}`);
      break;
    case 'video':
      tags.add('videos').add('page:home').add('brands').add('products').add('sitemap');
      break;
    case 'post':
      tags.add('posts').add('sitemap');
      if (slug) tags.add(`post:${slug}`);
      paths.add('/news');
      if (slug) paths.add(`/news/${slug}`);
      break;
    case 'page':
      tags.add('pages').add('sitemap');
      if (slug) tags.add(`page:${slug}`);
      if (slug === 'home') paths.add('/');
      else if (slug) paths.add(`/${slug}`);
      break;
    case 'subsidiary':
      tags.add('subsidiaries').add('pages').add('sitemap');
      break;
    case 'site':
      tags.add('site').add('menus').add('pages');
      break;
    case 'menu':
      tags.add('menus').add('site');
      break;
    case 'faq':
      tags.add('faqs');
      break;
    case 'testimonial':
      tags.add('testimonials').add('page:home');
      break;
    case 'redirect':
      tags.add('redirects');
      break;
    default:
      tags.add('site');
  }
  return { tags: [...tags], paths: [...paths] };
}
