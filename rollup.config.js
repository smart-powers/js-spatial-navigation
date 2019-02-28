import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';

import pkg from './package.json';

const defaultConfig = {
    input: 'src/index.js',
    external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})],
    plugins: [
        resolve(),
        babel(),
        terser({
            ecma: 5,
            ie8: true,
        }),
    ],
};

export default [
    // CommonJS
    {
        ...defaultConfig,
        output: { file: 'lib/js-spatial-navigation.js', format: 'cjs', indent: false },
    },

    // ES
    {
        ...defaultConfig,
        output: { file: 'es/js-spatial-navigation.js', format: 'es', indent: false },
    },
];
