import typescript from "rollup-plugin-typescript";
import resolve from "rollup-plugin-node-resolve";
import uglify from "rollup-plugin-uglify";

export default {
  entry: './src/ScrollyTeller.ts',
  plugins: [
    resolve(),
    typescript(),
    uglify({}, require("uglify-js-harmony").minify)
  ],
  targets: [
    {dest: "dist/ScrollyTeller.es.js", format: "es"},
    {dest: "dist/ScrollyTeller.browser.js", format: "iife", moduleName: "ScrollyTeller"},
    {dest: "dist/ScrollyTeller.cjs.js", format: "cjs"}
  ]
}