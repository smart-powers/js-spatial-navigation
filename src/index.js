/**
 * A javascript-based implementation of Spatial Navigation.
 *
 * Copyright (c) 2017 Luke Chang.
 * https://github.com/luke-chang/js-spatial-navigation
 *
 * Licensed under the MPL 2.0.
 */

import { EVENT_PREFIX, ID_POOL_PREFIX, KEYMAPPING, REVERSE } from './constants';
import { navigate } from './navigate';

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

const GlobalConfig = {
    selector: '', // can be a valid <extSelector> except "@" syntax.
    straightOnly: false,
    straightOverlapThreshold: 0.5,
    rememberSource: false,
    disabled: false,
    defaultElement: '', // <extSelector> except "@" syntax.
    enterTo: '', // '', 'last-focused', 'default-element'
    leaveFor: null, // {left: <extSelector>, right: <extSelector>,
    //  up: <extSelector>, down: <extSelector>}
    restrict: 'self-first', // 'self-first', 'self-only', 'none'
    tabIndexIgnoreList: 'a, input, select, textarea, button, iframe, [contentEditable=true]',
    navigableFilter: null,
};

/**
 * Private Variable
 */
const store = {
    idPool: 0,
    ready: false,
    pause: false,
    sections: {},
    sectionCount: 0,
    defaultSectionId: '',
    lastSectionId: '',
    duringFocusChange: false,
};

/**
 * Polyfill
 */
const elementMatchesSelector =
    Element.prototype.matches ||
    Element.prototype.matchesSelector ||
    Element.prototype.mozMatchesSelector ||
    Element.prototype.webkitMatchesSelector ||
    Element.prototype.msMatchesSelector ||
    Element.prototype.oMatchesSelector ||
    function elementMatchesSelectorHandler(selector) {
        const matchedNodes = (this.parentNode || this.document).querySelectorAll(selector);
        return [].slice.call(matchedNodes).indexOf(this) >= 0;
    };

/**
 * Private Function
 */
function generateId() {
    let id;

    while (true) {
        id = ID_POOL_PREFIX + String(++store.idPool);
        if (!store.sections[id]) {
            break;
        }
    }

    return id;
}

function parseSelector(selector) {
    let result;

    if (typeof selector === 'string') {
        result = [].slice.call(document.querySelectorAll(selector));
    } else if (typeof selector === 'object' && selector.length) {
        result = [].slice.call(selector);
    } else if (typeof selector === 'object' && selector.nodeType === 1) {
        result = [selector];
    } else {
        result = [];
    }

    return result;
}

function matchSelector(elem, selector) {
    if (typeof selector === 'string') {
        return elementMatchesSelector.call(elem, selector);
    }

    if (typeof selector === 'object' && selector.length) {
        return selector.indexOf(elem) >= 0;
    }

    if (typeof selector === 'object' && selector.nodeType === 1) {
        return elem === selector;
    }

    return false;
}

function getCurrentFocusedElement() {
    const { activeElement } = document;

    if (activeElement && activeElement !== document.body) {
        return activeElement;
    }

    return null;
}

function exclude(elemList, excludedElem) {
    if (!Array.isArray(excludedElem)) {
        excludedElem = [excludedElem];
    }

    for (let i = 0, index; i < excludedElem.length; i += 1) {
        index = elemList.indexOf(excludedElem[i]);

        if (index >= 0) {
            elemList.splice(index, 1);
        }
    }

    return elemList;
}

function isNavigable(elem, sectionId, verifySectionSelector) {
    if (!elem || !sectionId || !store.sections[sectionId] || store.sections[sectionId].disabled) {
        return false;
    }

    if ((elem.offsetWidth <= 0 && elem.offsetHeight <= 0) || elem.hasAttribute('disabled')) {
        return false;
    }

    if (verifySectionSelector && !matchSelector(elem, store.sections[sectionId].selector)) {
        return false;
    }

    if (typeof store.sections[sectionId].navigableFilter === 'function') {
        if (store.sections[sectionId].navigableFilter(elem, sectionId) === false) {
            return false;
        }
    } else if (typeof GlobalConfig.navigableFilter === 'function') {
        if (GlobalConfig.navigableFilter(elem, sectionId) === false) {
            return false;
        }
    }

    return true;
}

function getSectionId(elem) {
    return Object.keys(store.sections).find(
        id => !store.sections[id].disabled && matchSelector(elem, store.sections[id].selector),
    );
}

function getSectionNavigableElements(sectionId) {
    return parseSelector(store.sections[sectionId].selector).filter(elem => isNavigable(elem, sectionId));
}

function getSectionDefaultElement(sectionId) {
    let { defaultElement } = store.sections[sectionId];

    if (!defaultElement) {
        return null;
    }

    if (typeof defaultElement === 'string') {
        [defaultElement] = parseSelector(defaultElement);
    }

    if (isNavigable(defaultElement, sectionId, true)) {
        return defaultElement;
    }

    return null;
}

function getSectionLastFocusedElement(sectionId) {
    const { lastFocusedElement } = store.sections[sectionId];

    if (!isNavigable(lastFocusedElement, sectionId, true)) {
        return null;
    }

    return lastFocusedElement;
}

function fireEvent(elem, type, details, cancelable = true) {
    const evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(EVENT_PREFIX + type, true, cancelable, details);
    return elem.dispatchEvent(evt);
}

function focusChanged(elem, sectionId) {
    if (!sectionId) {
        sectionId = getSectionId(elem);
    }

    if (sectionId) {
        store.sections[sectionId].lastFocusedElement = elem;
        store.lastSectionId = sectionId;
    }
}

function focusElement(elem, sectionId, direction) {
    if (!elem) {
        return false;
    }

    const currentFocusedElement = getCurrentFocusedElement();

    const silentFocus = () => {
        if (currentFocusedElement) {
            currentFocusedElement.blur();
        }

        elem.focus();
        focusChanged(elem, sectionId);
    };

    if (store.duringFocusChange) {
        silentFocus();
        return true;
    }

    store.duringFocusChange = true;

    if (store.pause) {
        silentFocus();
        store.duringFocusChange = false;
        return true;
    }

    if (currentFocusedElement) {
        const unfocusProperties = {
            nextElement: elem,
            nextSectionId: sectionId,
            direction,
            native: false,
        };

        if (!fireEvent(currentFocusedElement, 'willunfocus', unfocusProperties)) {
            store.duringFocusChange = false;
            return false;
        }

        currentFocusedElement.blur();
        fireEvent(currentFocusedElement, 'unfocused', unfocusProperties, false);
    }

    const focusProperties = {
        previousElement: currentFocusedElement,
        sectionId,
        direction,
        native: false,
    };

    if (!fireEvent(elem, 'willfocus', focusProperties)) {
        store.duringFocusChange = false;
        return false;
    }

    elem.focus();
    fireEvent(elem, 'focused', focusProperties, false);

    store.duringFocusChange = false;

    focusChanged(elem, sectionId);

    return true;
}

function focusSection(sectionId) {
    const range = [];
    const addRange = id => {
        if (id && range.indexOf(id) < 0 && store.sections[id] && !store.sections[id].disabled) {
            range.push(id);
        }
    };

    if (sectionId) {
        addRange(sectionId);
    } else {
        addRange(store.defaultSectionId);
        addRange(store.lastSectionId);
        Object.keys(store.sections).map(addRange);
    }

    for (let i = 0; i < range.length; i += 1) {
        const id = range[i];
        let next;

        if (store.sections[id].enterTo === 'last-focused') {
            next =
                getSectionLastFocusedElement(id) || getSectionDefaultElement(id) || getSectionNavigableElements(id)[0];
        } else {
            next =
                getSectionDefaultElement(id) || getSectionLastFocusedElement(id) || getSectionNavigableElements(id)[0];
        }

        if (next) {
            return focusElement(next, id);
        }
    }

    return false;
}

function focusExtendedSelector(selector, direction) {
    if (selector.charAt(0) === '@') {
        if (selector.length === 1) {
            return focusSection();
        }

        const sectionId = selector.substr(1);

        return focusSection(sectionId);
    }

    const next = parseSelector(selector)[0];

    if (next) {
        const nextSectionId = getSectionId(next);

        if (isNavigable(next, nextSectionId)) {
            return focusElement(next, nextSectionId, direction);
        }
    }

    return false;
}

function fireNavigatefailed(elem, direction) {
    fireEvent(elem, 'navigatefailed', { direction }, false);
}

function gotoLeaveFor(sectionId, direction) {
    if (store.sections[sectionId].leaveFor && store.sections[sectionId].leaveFor[direction] !== undefined) {
        const next = store.sections[sectionId].leaveFor[direction];

        if (typeof next === 'string') {
            if (next === '') {
                return null;
            }

            return focusExtendedSelector(next, direction);
        }

        const nextSectionId = getSectionId(next);

        if (isNavigable(next, nextSectionId)) {
            return focusElement(next, nextSectionId, direction);
        }
    }

    return false;
}

function focusNext(direction, currentFocusedElement, currentSectionId) {
    const extSelector = currentFocusedElement.getAttribute(`data-sn-${direction}`);

    if (typeof extSelector === 'string') {
        if (extSelector === '' || !focusExtendedSelector(extSelector, direction)) {
            fireNavigatefailed(currentFocusedElement, direction);
            return false;
        }

        return true;
    }

    const sectionNavigableElements = {};
    let allNavigableElements = [];

    Object.keys(store.sections).forEach(id => {
        sectionNavigableElements[id] = getSectionNavigableElements(id);
        allNavigableElements = allNavigableElements.concat(sectionNavigableElements[id]);
    });

    const config = { ...GlobalConfig, ...store.sections[currentSectionId] };
    let next;

    if (config.restrict === 'self-only' || config.restrict === 'self-first') {
        const currentSectionNavigableElements = sectionNavigableElements[currentSectionId];

        next = navigate(
            currentFocusedElement,
            direction,
            exclude(currentSectionNavigableElements, currentFocusedElement),
            config,
        );

        if (!next && config.restrict === 'self-first') {
            next = navigate(
                currentFocusedElement,
                direction,
                exclude(allNavigableElements, currentSectionNavigableElements),
                config,
            );
        }
    } else {
        next = navigate(currentFocusedElement, direction, exclude(allNavigableElements, currentFocusedElement), config);
    }

    if (next) {
        store.sections[currentSectionId].previous = {
            target: currentFocusedElement,
            destination: next,
            reverse: REVERSE[direction],
        };

        const nextSectionId = getSectionId(next);

        if (currentSectionId !== nextSectionId) {
            const result = gotoLeaveFor(currentSectionId, direction);

            if (result) {
                return true;
            }

            if (result === null) {
                fireNavigatefailed(currentFocusedElement, direction);
                return false;
            }

            let enterToElement;

            switch (store.sections[nextSectionId].enterTo) {
                case 'last-focused': {
                    enterToElement =
                        getSectionLastFocusedElement(nextSectionId) || getSectionDefaultElement(nextSectionId);
                    break;
                }

                case 'default-element': {
                    enterToElement = getSectionDefaultElement(nextSectionId);
                    break;
                }
            }

            if (enterToElement) {
                next = enterToElement;
            }
        }

        return focusElement(next, nextSectionId, direction);
    }

    if (gotoLeaveFor(currentSectionId, direction)) {
        return true;
    }

    fireNavigatefailed(currentFocusedElement, direction);

    return false;
}

function onKeyDown(evt) {
    if (!store.sectionCount || store.pause || evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) {
        return null;
    }

    let currentFocusedElement;
    const preventDefault = () => {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
    };

    const direction = KEYMAPPING[evt.keyCode];

    if (!direction) {
        if (evt.keyCode === 13) {
            currentFocusedElement = getCurrentFocusedElement();

            if (currentFocusedElement && getSectionId(currentFocusedElement)) {
                if (!fireEvent(currentFocusedElement, 'enter-down')) {
                    return preventDefault();
                }
            }
        }

        return null;
    }

    currentFocusedElement = getCurrentFocusedElement();

    if (!currentFocusedElement) {
        if (store.lastSectionId) {
            currentFocusedElement = getSectionLastFocusedElement(store.lastSectionId);
        }

        if (!currentFocusedElement) {
            focusSection();
            return preventDefault();
        }
    }

    const currentSectionId = getSectionId(currentFocusedElement);

    if (!currentSectionId) {
        return null;
    }

    const willmoveProperties = {
        direction,
        sectionId: currentSectionId,
        cause: 'keydown',
    };

    if (fireEvent(currentFocusedElement, 'willmove', willmoveProperties)) {
        focusNext(direction, currentFocusedElement, currentSectionId);
    }

    return preventDefault();
}

function onKeyUp(evt) {
    if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) {
        return null;
    }

    if (!store.pause && store.sectionCount && evt.keyCode === 13) {
        const currentFocusedElement = getCurrentFocusedElement();

        if (currentFocusedElement && getSectionId(currentFocusedElement)) {
            if (!fireEvent(currentFocusedElement, 'enter-up')) {
                evt.preventDefault();
                evt.stopPropagation();
            }
        }
    }
}

function onFocus(evt) {
    const { target } = evt;

    if (target !== window && target !== document && store.sectionCount && !store.duringFocusChange) {
        const sectionId = getSectionId(target);

        if (sectionId) {
            if (store.pause) {
                focusChanged(target, sectionId);
                return;
            }

            const focusProperties = {
                sectionId,
                native: true,
            };

            if (!fireEvent(target, 'willfocus', focusProperties)) {
                store.duringFocusChange = true;
                target.blur();
                store.duringFocusChange = false;
            } else {
                fireEvent(target, 'focused', focusProperties, false);
                focusChanged(target, sectionId);
            }
        }
    }
}

function onBlur(evt) {
    const { target } = evt;

    if (
        target !== window &&
        target !== document &&
        !store.pause &&
        store.sectionCount &&
        !store.duringFocusChange &&
        getSectionId(target)
    ) {
        const unfocusProperties = {
            native: true,
        };

        if (!fireEvent(target, 'willunfocus', unfocusProperties)) {
            store.duringFocusChange = true;
            setTimeout(() => {
                target.focus();
                store.duringFocusChange = false;
            });
        } else {
            fireEvent(target, 'unfocused', unfocusProperties, false);
        }
    }
}

/**
 * Public Function
 */
const SpatialNavigation = {
    init() {
        if (!store.ready) {
            window.addEventListener('keydown', onKeyDown);
            window.addEventListener('keyup', onKeyUp);
            window.addEventListener('focus', onFocus, true);
            window.addEventListener('blur', onBlur, true);
            store.ready = true;
        }
    },

    uninit() {
        window.removeEventListener('blur', onBlur, true);
        window.removeEventListener('focus', onFocus, true);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('keydown', onKeyDown);
        SpatialNavigation.clear();
        store.idPool = 0;
        store.ready = false;
    },

    clear() {
        store.sections = {};
        store.sectionCount = 0;
        store.defaultSectionId = '';
        store.lastSectionId = '';
        store.duringFocusChange = false;
    },

    // set(<config>);
    // set(<sectionId>, <config>);
    set(...args) {
        let sectionId;
        let config;

        if (typeof args[0] === 'object') {
            [config] = args;
        } else if (typeof args[0] === 'string' && typeof args[1] === 'object') {
            [sectionId, config] = args;

            if (!store.sections[sectionId]) {
                throw new Error(`Section "${sectionId}" doesn't exist!`);
            }
        } else {
            return;
        }

        Object.keys(config).forEach(key => {
            if (GlobalConfig[key] !== undefined) {
                if (sectionId) {
                    store.sections[sectionId][key] = config[key];
                } else if (config[key] !== undefined) {
                    GlobalConfig[key] = config[key];
                }
            }
        });

        if (sectionId) {
            // remove "undefined" items
            store.sections[sectionId] = { ...store.sections[sectionId] };
        }
    },

    // add(<config>);
    // add(<sectionId>, <config>);
    add(...args) {
        let sectionId;
        let config = {};

        if (typeof args[0] === 'object') {
            [config] = args;
        } else if (typeof args[0] === 'string' && typeof args[1] === 'object') {
            [sectionId, config] = args;
        }

        if (!sectionId) {
            sectionId = typeof config.id === 'string' ? config.id : generateId();
        }

        if (store.sections[sectionId]) {
            throw new Error(`Section "${sectionId}" has already existed!`);
        }

        store.sections[sectionId] = {};
        store.sectionCount += 1;

        SpatialNavigation.set(sectionId, config);

        return sectionId;
    },

    remove(sectionId) {
        if (!sectionId || typeof sectionId !== 'string') {
            throw new Error('Please assign the "sectionId"!');
        }

        if (store.sections[sectionId]) {
            delete store.sections[sectionId];
            store.sections = { ...store.sections };
            store.sectionCount -= 1;

            if (store.lastSectionId === sectionId) {
                store.lastSectionId = '';
            }

            return true;
        }

        return false;
    },

    disable(sectionId) {
        if (store.sections[sectionId]) {
            store.sections[sectionId].disabled = true;
            return true;
        }

        return false;
    },

    enable(sectionId) {
        if (store.sections[sectionId]) {
            store.sections[sectionId].disabled = false;
            return true;
        }

        return false;
    },

    pause() {
        store.pause = true;
    },

    resume() {
        store.pause = false;
    },

    // focus([silent])
    // focus(<sectionId>, [silent])
    // focus(<extSelector>, [silent])
    // Note: "silent" is optional and default to false
    focus(elem, silent) {
        let result = false;

        if (silent === undefined && typeof elem === 'boolean') {
            silent = elem;
            elem = undefined;
        }

        const autoPause = !store.pause && silent;

        if (autoPause) {
            SpatialNavigation.pause();
        }

        if (!elem) {
            result = focusSection();
        } else if (typeof elem === 'string') {
            if (store.sections[elem]) {
                result = focusSection(elem);
            } else {
                result = focusExtendedSelector(elem);
            }
        } else {
            const nextSectionId = getSectionId(elem);

            if (isNavigable(elem, nextSectionId)) {
                result = focusElement(elem, nextSectionId);
            }
        }

        if (autoPause) {
            SpatialNavigation.resume();
        }

        return result;
    },

    // move(<direction>)
    // move(<direction>, <selector>)
    move(direction, selector) {
        direction = direction.toLowerCase();

        if (!REVERSE[direction]) {
            return false;
        }

        const elem = selector ? parseSelector(selector)[0] : getCurrentFocusedElement();

        if (!elem) {
            return false;
        }

        const sectionId = getSectionId(elem);

        if (!sectionId) {
            return false;
        }

        const willmoveProperties = {
            direction,
            sectionId,
            cause: 'api',
        };

        if (!fireEvent(elem, 'willmove', willmoveProperties)) {
            return false;
        }

        return focusNext(direction, elem, sectionId);
    },

    // makeFocusable()
    // makeFocusable(<sectionId>)
    makeFocusable(sectionId) {
        const doMakeFocusable = section => {
            const tabIndexIgnoreList =
                section.tabIndexIgnoreList !== undefined ? section.tabIndexIgnoreList : GlobalConfig.tabIndexIgnoreList;

            parseSelector(section.selector).forEach(elem => {
                if (!matchSelector(elem, tabIndexIgnoreList)) {
                    if (!elem.getAttribute('tabindex')) {
                        elem.setAttribute('tabindex', '-1');
                    }
                }
            });
        };

        if (sectionId) {
            if (store.sections[sectionId]) {
                doMakeFocusable(store.sections[sectionId]);
            } else {
                throw new Error(`Section "${sectionId}" doesn't exist!`);
            }
        } else {
            Object.keys(store.sections).forEach(id => {
                doMakeFocusable(store.sections[id]);
            });
        }
    },

    setDefaultSection(sectionId) {
        if (!sectionId) {
            store.defaultSectionId = '';
        } else if (!store.sections[sectionId]) {
            throw new Error(`Section "${sectionId}" doesn't exist!`);
        } else {
            store.defaultSectionId = sectionId;
        }
    },
};

export default SpatialNavigation;
