module.exports = {
    extends: ['airbnb-base', 'prettier'],
    parser: 'babel-eslint',
    plugins: ['import', 'prettier', 'simple-import-sort'],

    rules: {
        indent: [
            'error',
            4,
            {
                SwitchCase: 1,
            },
        ],
        'sort-imports': 'off',
        'simple-import-sort/sort': 'error',
        'import/prefer-default-export': 'off',
        'prettier/prettier': 'error',
    },
    env: {
        browser: true,
    },
};
