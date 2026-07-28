import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { blogSchema, knowledgeSchema } from "./lib/schemas";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: blogSchema,
});

const knowledge = defineCollection({
  loader: glob({ base: "./src/content/knowledge", pattern: "**/*.{md,mdx}" }),
  schema: knowledgeSchema,
});

export const collections = { blog, knowledge };
