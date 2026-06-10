import type { Brief, SiteSpec, QualityReport } from './ai/types';
import { slugify } from './ai/seo';
import { prisma, hasDatabase } from './db';

export interface StoredProject {
  id: string;
  slug: string;
  brief: Brief;
  status: 'READY' | 'GENERATING' | 'FAILED';
  engine: string;
  spec: SiteSpec;
  report: QualityReport;
  createdAt: string;
}

/**
 * Persistence abstraction. Uses PostgreSQL via Prisma when DATABASE_URL is set,
 * otherwise an in-process store so the app is fully runnable with zero infra
 * (e.g. for previews, demos, and tests).
 */
const memory = new Map<string, StoredProject>();

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function saveProject(input: {
  brief: Brief;
  spec: SiteSpec;
  engine: string;
  report: QualityReport;
}): Promise<StoredProject> {
  const id = makeId();
  const slug = `${slugify(input.brief.companyName)}-${id.slice(0, 5)}`;
  const project: StoredProject = {
    id,
    slug,
    brief: input.brief,
    status: 'READY',
    engine: input.engine,
    spec: input.spec,
    report: input.report,
    createdAt: new Date().toISOString(),
  };

  if (hasDatabase()) {
    try {
      const row = await prisma.project.create({
        data: {
          companyName: input.brief.companyName,
          industry: input.brief.industry,
          description: input.brief.description,
          style: input.brief.style,
          locales: input.brief.locales,
          kind: input.brief.kind,
          status: 'READY',
          slug,
          engine: input.engine,
          spec: input.spec as unknown as object,
          products: input.spec.store
            ? {
                create: input.spec.store.products.map((p) => ({
                  sku: p.sku,
                  name: p.name,
                  description: p.description,
                  priceCents: p.priceCents,
                  currency: p.currency,
                  category: p.category,
                  imagePrompt: p.imagePrompt,
                })),
              }
            : undefined,
        },
      });
      return { ...project, id: row.id, slug: row.slug };
    } catch {
      // Fall through to in-memory if the database is unreachable.
    }
  }

  memory.set(id, project);
  memory.set(slug, project);
  return project;
}

export async function getProject(idOrSlug: string): Promise<StoredProject | null> {
  if (memory.has(idOrSlug)) return memory.get(idOrSlug) ?? null;

  if (hasDatabase()) {
    try {
      const row =
        (await prisma.project.findUnique({ where: { id: idOrSlug } })) ??
        (await prisma.project.findUnique({ where: { slug: idOrSlug } }));
      if (row?.spec) {
        return {
          id: row.id,
          slug: row.slug,
          brief: {
            companyName: row.companyName,
            industry: row.industry,
            description: row.description,
            style: row.style,
            locales: row.locales,
            kind: row.kind,
          },
          status: 'READY',
          engine: row.engine ?? 'unknown',
          spec: row.spec as unknown as SiteSpec,
          report: (row.spec as unknown as SiteSpec & { report?: QualityReport }).report ?? emptyReport(),
          createdAt: row.createdAt.toISOString(),
        };
      }
    } catch {
      /* ignore and return null */
    }
  }
  return null;
}

export async function listProjects(): Promise<StoredProject[]> {
  if (hasDatabase()) {
    try {
      const rows = await prisma.project.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return rows
        .filter((r) => r.spec)
        .map((row) => ({
          id: row.id,
          slug: row.slug,
          brief: {
            companyName: row.companyName,
            industry: row.industry,
            description: row.description,
            style: row.style,
            locales: row.locales,
            kind: row.kind,
          },
          status: 'READY' as const,
          engine: row.engine ?? 'unknown',
          spec: row.spec as unknown as SiteSpec,
          report: emptyReport(),
          createdAt: row.createdAt.toISOString(),
        }));
    } catch {
      /* fall through */
    }
  }
  const seen = new Set<string>();
  return [...memory.values()]
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function emptyReport(): QualityReport {
  return { seo: 0, accessibility: 0, performance: 0, security: 0, findings: [], passed: false };
}
