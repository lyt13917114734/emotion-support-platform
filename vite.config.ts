import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig(async () => {
  const { cloudflare } = await import('@cloudflare/vite-plugin');
  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        inspectorPort: false,
        config: {
          name: 'emotion-support-platform',
          main: 'vinext/server/fetch-handler',
          compatibility_flags: ['nodejs_compat'],
        },
      }),
    ],
    server: { host: '127.0.0.1', port: 3000 },
  };
});
