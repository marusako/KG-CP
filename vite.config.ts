import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages ではページが /KG-CP/ の下に置かれるので、読み込むファイルは相対パスで参照する
  base: './',
});
