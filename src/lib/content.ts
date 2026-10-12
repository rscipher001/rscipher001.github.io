import { getCollection, type CollectionEntry } from 'astro:content';
import { slug } from 'github-slugger';
import { site } from '../site.config';

type Dated = CollectionEntry<'posts'> | CollectionEntry<'projects'>;

/** Drafts are shown while developing and left out of the built site. */
export const published = <T extends { data: { draft: boolean } }>(entry: T) => import.meta.env.DEV || !entry.data.draft;

const newestFirst = (a: Dated, b: Dated) => b.data.date.valueOf() - a.data.date.valueOf();

export async function getPosts() {
  return (await getCollection('posts', published)).sort(newestFirst);
}

export async function getProjects() {
  return (await getCollection('projects', published)).sort(newestFirst);
}

export async function getPages() {
  return getCollection('pages', published);
}

export const tagSlug = (tag: string) => slug(tag);

/** Every tag with the posts that carry it, most used first. */
export async function getTags() {
  const tags = new Map<string, { name: string; posts: CollectionEntry<'posts'>[] }>();
  for (const post of await getPosts()) {
    for (const name of post.data.tags) {
      const key = tagSlug(name);
      if (!tags.has(key)) tags.set(key, { name, posts: [] });
      tags.get(key)!.posts.push(post);
    }
  }
  return [...tags.entries()]
    .map(([slug, tag]) => ({ slug, ...tag }))
    .sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name));
}

/** Rough reading time at 220 words a minute. */
export function readingTime(body = '') {
  const words = body.split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 220))} min read`;
}

// Dates are written without a time, so they are read and shown as UTC.
const longDate = new Intl.DateTimeFormat(site.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat(site.locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const formatDate = (date: Date) => longDate.format(date);
export const formatShortDate = (date: Date) => shortDate.format(date);
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);
