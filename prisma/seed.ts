/**
 * Seed script: generates a couple of example projects so the dashboard and
 * admin views have data on a fresh database. Run with `npm run db:seed`.
 */
import { PrismaClient } from '@prisma/client';
import { generateSite } from '../src/lib/ai/engine';
import { slugify } from '../src/lib/ai/seo';
import type { Brief } from '../src/lib/ai/types';

const prisma = new PrismaClient();

const briefs: Brief[] = [
  {
    companyName: 'Northwind Studio',
    industry: 'Interior design',
    description: 'We design calm, functional living spaces for busy families.',
    style: 'elegant',
    locales: ['en'],
    kind: 'WEBSITE',
  },
  {
    companyName: 'Bean & Bloom',
    industry: 'Specialty coffee',
    description: 'Single-origin coffee roasted weekly and shipped to your door.',
    style: 'natural',
    locales: ['en'],
    kind: 'STORE',
  },
];

async function main() {
  for (const brief of briefs) {
    const { spec, engine } = await generateSite(brief, 'deterministic');
    const slug = `${slugify(brief.companyName)}-seed`;
    await prisma.project.upsert({
      where: { slug },
      update: { spec: spec as unknown as object, engine },
      create: {
        companyName: brief.companyName,
        industry: brief.industry,
        description: brief.description,
        style: brief.style,
        locales: brief.locales,
        kind: brief.kind,
        status: 'READY',
        slug,
        engine,
        spec: spec as unknown as object,
      },
    });
    console.log(`Seeded ${brief.companyName}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
