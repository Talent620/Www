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
// In-memory projects keyed by id, with a slug→id index. Bounded with FIFO
// eviction so a long-running keyless instance can't leak memory.
const memory = new Map<string, StoredProject>();
const slugIndex = new Map<string, string>();
const MAX_MEMORY_PROJECTS = 500;
const MAX_MEMORY_LEADS = 2000;

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function rememberProject(project: StoredProject): void {
  if (memory.size >= MAX_MEMORY_PROJECTS) {
    const oldestId = memory.keys().next().value as string | undefined;
    if (oldestId) {
      const evicted = memory.get(oldestId);
      memory.delete(oldestId);
      if (evicted) slugIndex.delete(evicted.slug);
    }
  }
  memory.set(project.id, project);
  slugIndex.set(project.slug, project.id);
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

  rememberProject(project);
  return project;
}

export async function getProject(idOrSlug: string): Promise<StoredProject | null> {
  const byId = memory.get(idOrSlug);
  if (byId) return byId;
  const viaSlug = slugIndex.get(idOrSlug);
  if (viaSlug) return memory.get(viaSlug) ?? null;

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
  return [...memory.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function emptyReport(): QualityReport {
  return { seo: 0, accessibility: 0, performance: 0, security: 0, findings: [], passed: false };
}

/* --------------------------------- leads --------------------------------- */

export interface StoredLead {
  id: string;
  projectId: string;
  name: string;
  email: string;
  company?: string;
  message: string;
  spam: boolean;
  createdAt: string;
}

const leadsMemory: StoredLead[] = [];

export async function saveLead(input: {
  projectId: string;
  name: string;
  email: string;
  company?: string;
  message: string;
  spam: boolean;
}): Promise<StoredLead> {
  const lead: StoredLead = {
    id: makeId(),
    ...input,
    createdAt: new Date().toISOString(),
  };

  if (hasDatabase()) {
    try {
      const row = await prisma.lead.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          email: input.email,
          company: input.company,
          message: input.message,
          spam: input.spam,
        },
      });
      return { ...lead, id: row.id, createdAt: row.createdAt.toISOString() };
    } catch {
      /* fall through to memory */
    }
  }

  leadsMemory.push(lead);
  if (leadsMemory.length > MAX_MEMORY_LEADS) leadsMemory.shift();
  return lead;
}

export async function listLeads(projectId: string): Promise<StoredLead[]> {
  if (hasDatabase()) {
    try {
      const rows = await prisma.lead.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      if (rows.length > 0 || leadsMemory.length === 0) {
        return rows.map((r) => ({
          id: r.id,
          projectId: r.projectId,
          name: r.name,
          email: r.email,
          company: r.company ?? undefined,
          message: r.message,
          spam: r.spam,
          createdAt: r.createdAt.toISOString(),
        }));
      }
    } catch {
      /* fall through */
    }
  }
  return leadsMemory
    .filter((l) => l.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
