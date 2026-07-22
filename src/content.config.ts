import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const baseSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
});

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: baseSchema,
});

const knowledge = defineCollection({
  loader: glob({ base: "./src/content/knowledge", pattern: "**/*.{md,mdx}" }),
  schema: baseSchema.extend({
    category: z.string(),
  }),
});

export const collections = { blog, knowledge };
