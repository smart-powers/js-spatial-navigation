import { globalConfig } from './globalConfig';
import {
    fireEvent,
    focusChanged,
    focusNext,
    focusSection,
    getCurrentFocusedElement,
    getSectionId,
    getSectionLastFocusedElement,
} from './helpers';
import { store } from './store';

export function onKeyDown(evt) {
    if (!store.sectionCount || store.pause || evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) {
        return;
    }

    let currentFocusedElement;
    const preventDefault = () => {
        evt.preventDefault();
        evt.stopPropagation();
    };

    const direction = globalConfig.directionKeys[evt.keyCode];

    if (!direction) {
        if (evt.keyCode === globalConfig.enterKey) {
            currentFocusedElement = getCurrentFocusedElement();

            if (currentFocusedElement && getSectionId(currentFocusedElement)) {
                if (!fireEvent(currentFocusedElement, 'enter-down')) {
                    preventDefault();
                    return;
                }
            }
        }

        return;
    }

    currentFocusedElement = getCurrentFocusedElement();

    if (!currentFocusedElement) {
        if (store.lastSectionId) {
            currentFocusedElement = getSectionLastFocusedElement(store.lastSectionId);
        }

        if (!currentFocusedElement) {
            focusSection();
            preventDefault();
            return;
        }
    }

    const currentSectionId = getSectionId(currentFocusedElement);

    if (!currentSectionId) {
        return;
    }

    const willmoveProperties = {
        direction,
        sectionId: currentSectionId,
        cause: 'keydown',
    };

    if (fireEvent(currentFocusedElement, 'willmove', willmoveProperties)) {
        focusNext(direction, currentFocusedElement, currentSectionId);
    }

    preventDefault();
}

export function onKeyUp(evt) {
    if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) {
        return;
    }

    if (!store.pause && store.sectionCount && evt.keyCode === globalConfig.enterKey) {
        const currentFocusedElement = getCurrentFocusedElement();

        if (currentFocusedElement && getSectionId(currentFocusedElement)) {
            if (!fireEvent(currentFocusedElement, 'enter-up')) {
                evt.preventDefault();
                evt.stopPropagation();
            }
        }
    }
}

export function onFocus(evt) {
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

export function onBlur(evt) {
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
