import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import glsl from 'vite-plugin-glsl';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/3d-audio-visualizer/' : '/',
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
}));
