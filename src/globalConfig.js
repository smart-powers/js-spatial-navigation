/**
 * Global Configuration
 *
 * NOTE: an <extSelector> can be one of following types:
 *  - a valid selector string for "querySelectorAll"
 *  - a NodeList or an array containing DOM elements
 *  - a single DOM element
 *  - a string "@<sectionId>" to indicate the specified section
 *  - a string "@" to indicate the default section
 */
export const globalConfig = {
    selector: '', // can be a valid <extSelector> except "@" syntax.
    straightOnly: false,
    straightOverlapThreshold: 0.5,
    rememberSource: false,
    disabled: false,
    defaultElement: '', // <extSelector> except "@" syntax.
    enterTo: '', // '', 'last-focused', 'default-element'
    leaveFor: null, // { left: <extSelector>, right: <extSelector>, up: <extSelector>, down: <extSelector> }
    restrict: 'self-first', // 'self-first', 'self-only', 'none'
    tabIndexIgnoreList: 'a, input, select, textarea, button, iframe, [contentEditable=true]',
    navigableFilter: null,
};
