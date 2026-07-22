import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],server:{host:'127.0.0.1',watch:{ignored:['**/tools/**']},proxy:{'/api':'http://127.0.0.1:5174'}}});
