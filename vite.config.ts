import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
// import babel from "vite-plugin-babel";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // babel({
    //   babelConfig: {
    //     babelrc: false,
    //     configFile: false,
    //     plugins: ["module:@react-three/babel"],
    //   },
    // }),
  ],
  server: {
    port: 5172,
  }
});
