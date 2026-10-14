import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { existsSync, lstatSync, realpathSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// The pinned vinext CLI forces process.exit after build. Use its build APIs and
// let native handles close naturally on Windows; errors still fail the command.
const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const outDir = resolve(root, 'dist');
const inside = relative(root, outDir);
if (!inside || inside.startsWith('..') || isAbsolute(inside) || (existsSync(outDir) && lstatSync(outDir).isSymbolicLink())) throw new Error('Unsafe build output directory.');
process.env.NODE_ENV = 'production';
// Set NODE_ENV before importing tooling that may load React in this process.
const { createBuilder } = await import('vite');
const { loadNextConfig, resolveNextConfig, createRscCompatibilityId, PHASE_PRODUCTION_BUILD } = await import('vinext/internal/config/next-config');
const { runPrerender } = await import('vinext/internal/build/run-prerender');
const { emitPrerenderPathManifest } = await import('vinext/internal/build/prerender-paths');
const nextConfig = await resolveNextConfig(await loadNextConfig(root, PHASE_PRODUCTION_BUILD), root);
if (nextConfig.output !== 'export') throw new Error('This project build supports static export only.');
process.env.__VINEXT_SHARED_BUILD_ID = nextConfig.buildId;
process.env.__VINEXT_SHARED_RSC_COMPATIBILITY_ID = createRscCompatibilityId(nextConfig);
process.env.__VINEXT_SHARED_REVALIDATE_SECRET = randomBytes(32).toString('hex');
// Only generated dist/ is cleared; source files and browser data are untouched.
rmSync(outDir, { recursive: true, force: true });
await (await createBuilder({ root, mode: 'production' })).buildApp();
await runPrerender({ root, nextConfig });
await emitPrerenderPathManifest({ root, nextConfig });
if (!existsSync(resolve(outDir, 'client', 'index.html'))) throw new Error('Static index was not generated.');
console.log('Static build complete: dist/client. Start locally with pnpm start.');
