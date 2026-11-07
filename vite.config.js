import { defineConfig } from 'vite';
export default defineConfig({ base: './', server: { host: process.env.HOST || '0.0.0.0', port: Number(process.env.PORT) || 5173 } });
