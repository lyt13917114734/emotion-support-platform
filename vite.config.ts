import tailwindcss from '@tailwindcss/postcss';
import { sites } from '@openai/sites-vite-plugin';
import vinext from 'vinext';
import { defineConfig } from 'vite';
const hostingConfig = { d1: 'DB' };

const PLACEHOLDER_DATABASE_ID = '00000000-0000-4000-8000-000000000000';

export default defineConfig(async () => {
  const { cloudflare } = await import('@cloudflare/vite-plugin');
  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        inspectorPort: false,
        config: {
          main: 'vinext/server/fetch-handler',
          compatibility_flags: ['nodejs_compat'],
          d1_databases: hostingConfig.d1 ? [{
            binding: hostingConfig.d1,
            database_name: 'experiment2-platform-d1',
            database_id: PLACEHOLDER_DATABASE_ID,
          }] : [],
        },
      }),
    ],
    server: { host: '127.0.0.1', port: 3000 },
  };
});
