import { EVENT_PREFIX, ID_POOL_PREFIX, REVERSE } from './constants';
import { globalConfig } from './globalConfig';
import { navigate } from './navigate';
import { elementMatchesSelector } from './polyfills';
import { store } from './store';

export function generateId() {
    let id;

    do {
        store.idPool += 1;
        id = ID_POOL_PREFIX + String(store.idPool);
    } while (!store.sections[id]);

    return id;
}

export function parseSelector(selector) {
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

export function matchSelector(elem, selector) {
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

export function getCurrentFocusedElement() {
    const { activeElement } = document;

    if (activeElement && activeElement !== document.body) {
        return activeElement;
    }

    return null;
}

export function exclude(elemList, excludedElem) {
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

export function isNavigable(elem, sectionId, verifySectionSelector) {
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
    } else if (typeof globalConfig.navigableFilter === 'function') {
        if (globalConfig.navigableFilter(elem, sectionId) === false) {
            return false;
        }
    }

    return true;
}

export function getSectionId(elem) {
    return Object.keys(store.sections).find(
        id => !store.sections[id].disabled && matchSelector(elem, store.sections[id].selector),
    );
}

export function getSectionNavigableElements(sectionId) {
    return parseSelector(store.sections[sectionId].selector).filter(elem => isNavigable(elem, sectionId));
}

export function getSectionDefaultElement(sectionId) {
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

export function getSectionLastFocusedElement(sectionId) {
    const { lastFocusedElement } = store.sections[sectionId];

    if (!isNavigable(lastFocusedElement, sectionId, true)) {
        return null;
    }

    return lastFocusedElement;
}

export function fireEvent(elem, type, details, cancelable = true) {
    const evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(EVENT_PREFIX + type, true, cancelable, details);
    return elem.dispatchEvent(evt);
}

export function focusChanged(elem, sectionId) {
    if (!sectionId) {
        sectionId = getSectionId(elem);
    }

    if (sectionId) {
        store.sections[sectionId].lastFocusedElement = elem;
        store.lastSectionId = sectionId;
    }
}

export function focusElement(elem, sectionId, direction) {
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

export function focusSection(sectionId) {
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

export function focusExtendedSelector(selector, direction) {
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

export function fireNavigatefailed(elem, direction) {
    fireEvent(elem, 'navigatefailed', { direction }, false);
}

export function gotoLeaveFor(sectionId, direction) {
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

export function focusNext(direction, currentFocusedElement, currentSectionId) {
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

    const config = { ...globalConfig, ...store.sections[currentSectionId] };
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

                default: {
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
