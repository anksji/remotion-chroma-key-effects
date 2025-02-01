import react from '@vitejs/plugin-react';
import {resolve} from 'path';
import {defineConfig} from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
	plugins: [react(), dts({include: ['src']})],
	build: {
		lib: {
			entry: resolve(__dirname, 'src/lib/index.ts'),
			name: 'effects',
			fileName: (format) => `my-react-lib.${format}.js`,
			formats: ['es', 'umd'],
		},
		rollupOptions: {
			external: ['react', 'react-dom'],
			output: {
				globals: {
					react: 'React',
					'react-dom': 'ReactDOM',
				},
			},
		},
	},
});
