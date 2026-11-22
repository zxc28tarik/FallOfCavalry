import {defineConfig} from 'vite';

// Distribution-only configuration: preserve the real game entry and the
// real Vite import graph, but collapse dynamic imports and embed local assets.
export default defineConfig({
  base:'./',
  build:{
    outDir:'dist-single',
    emptyOutDir:true,
    assetsInlineLimit:100_000_000,
    cssCodeSplit:false,
    rollupOptions:{output:{inlineDynamicImports:true}},
  },
});
