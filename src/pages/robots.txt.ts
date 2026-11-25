// /robots.txt (ADR 0001 §7, research §4): every crawler is allowed, including AI search bots; points to the sitemap.
import type { APIRoute } from 'astro';
import { site } from '../config/site.ts';
import { buildRobotsTxt } from '../lib/sitemap.ts';

export const GET: APIRoute = () =>
  new Response(buildRobotsTxt(site.url), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
