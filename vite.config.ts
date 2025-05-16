import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    glsl({
      include: ['**/*.glsl', '**/*.vs', '**/*.fs'],
    }),
  ],
  server: {
    port: 3000,
    open: true,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
