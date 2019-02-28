/**
 * A javascript-based implementation of Spatial Navigation.
 *
 * Copyright (c) 2017 Luke Chang.
 * https://github.com/luke-chang/js-spatial-navigation
 *
 * Licensed under the MPL 2.0.
 */

import { REVERSE } from './constants';
import { globalConfig } from './globalConfig';
import {
    fireEvent,
    focusElement,
    focusExtendedSelector,
    focusNext,
    focusSection,
    generateId,
    getCurrentFocusedElement,
    getSectionId,
    isNavigable,
    matchSelector,
    parseSelector,
} from './helpers';
import { onBlur, onFocus, onKeyDown, onKeyUp } from './listeners';
import { store } from './store';

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
            if (globalConfig[key] !== undefined) {
                if (sectionId) {
                    store.sections[sectionId][key] = config[key];
                } else if (config[key] !== undefined) {
                    globalConfig[key] = config[key];
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

    /**
     *
     * Possible variations of arguments:
     * * focus([silent])
     * * focus(<sectionId>, [silent])
     * * focus(<extSelector>, [silent])
     *
     * @param {Element} elem
     * @param {boolean} silent is optional and default to false
     * @returns {boolean}
     */
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
                section.tabIndexIgnoreList !== undefined ? section.tabIndexIgnoreList : globalConfig.tabIndexIgnoreList;

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
