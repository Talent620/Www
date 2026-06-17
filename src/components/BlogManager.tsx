'use client';

import type { BlogPost } from '@/lib/ai/types';

/**
 * Blog content manager for the editor. Create, edit, reorder, publish/draft and
 * delete posts. Posts live in the SiteSpec (no extra storage), so saving the
 * project persists them and the export renders a /blog index + per-post pages.
 */
export function BlogManager({
  posts,
  companyName,
  onChange,
}: {
  posts: BlogPost[];
  companyName: string;
  onChange: (posts: BlogPost[]) => void;
}) {
  const update = (i: number, patch: Partial<BlogPost>) =>
    onChange(posts.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= posts.length) return;
    const next = posts.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  const remove = (i: number) => onChange(posts.filter((_, idx) => idx !== i));

  const add = () => onChange([newPost(posts, companyName), ...posts]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Blog</h1>
          <p className="text-sm text-slate-400">
            {posts.length} {posts.length === 1 ? 'post' : 'posts'} ·{' '}
            {posts.filter((p) => !p.draft).length} published
          </p>
        </div>
        <button
          onClick={add}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold hover:bg-brand-500"
        >
          + New post
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {posts.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-500">
            No posts yet. Create your first one.
          </p>
        )}
        {posts.map((post, i) => (
          <article key={i} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <input
                value={post.title}
                onChange={(e) => update(i, { title: e.target.value, slug: slugify(e.target.value) || post.slug })}
                placeholder="Post title"
                className="flex-1 rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              />
              <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={!post.draft}
                  onChange={(e) => update(i, { draft: !e.target.checked })}
                />
                {post.draft ? 'Draft' : 'Published'}
              </label>
            </div>
            <p className="mb-2 text-xs text-slate-500">/blog/{post.slug}</p>
            <textarea
              value={post.excerpt}
              onChange={(e) => update(i, { excerpt: e.target.value })}
              placeholder="Short excerpt (shown in the blog list)"
              rows={2}
              className="mb-2 w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200"
            />
            <textarea
              value={post.body}
              onChange={(e) => update(i, { body: e.target.value })}
              placeholder="Post body — use '# ', '## ' for headings and '- ' for list items"
              rows={8}
              className="mb-2 w-full rounded bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200"
            />
            <input
              value={post.tags.join(', ')}
              onChange={(e) =>
                update(i, { tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })
              }
              placeholder="tags, comma, separated"
              className="mb-3 w-full rounded bg-slate-900 px-3 py-2 text-xs text-slate-300"
            />
            <div className="flex items-center gap-2 text-xs">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600 disabled:opacity-30">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === posts.length - 1} className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600 disabled:opacity-30">↓</button>
              <button onClick={() => remove(i)} className="ml-auto rounded bg-red-900/60 px-3 py-1 text-red-200 hover:bg-red-900">Delete</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function newPost(existing: BlogPost[], companyName: string): BlogPost {
  let slug = 'new-post';
  let n = 1;
  const taken = new Set(existing.map((p) => p.slug));
  while (taken.has(slug)) slug = `new-post-${++n}`;
  const title = 'New post';
  return {
    slug,
    title,
    excerpt: '',
    body: '# New post\n\nStart writing here.',
    tags: [],
    draft: true,
    seo: {
      title: `${title} | ${companyName}`.slice(0, 60),
      description: `A new article from ${companyName}.`,
      canonical: `/blog/${slug}`,
      openGraph: { title, description: `A new article from ${companyName}.`, type: 'article' },
      twitter: { card: 'summary', title, description: `A new article from ${companyName}.` },
      jsonLd: [],
    },
  };
}
