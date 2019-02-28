export function getRect(elem) {
    const cr = elem.getBoundingClientRect();
    const rect = {
        left: cr.left,
        top: cr.top,
        right: cr.right,
        bottom: cr.bottom,
        width: cr.width,
        height: cr.height,
    };

    rect.element = elem;
    rect.center = {
        x: rect.left + Math.floor(rect.width / 2),
        y: rect.top + Math.floor(rect.height / 2),
    };

    rect.center.left = rect.center.x;
    rect.center.right = rect.center.x;
    rect.center.top = rect.center.y;
    rect.center.bottom = rect.center.y;

    return rect;
}

export function partition(rects, targetRect, straightOverlapThreshold) {
    const groups = [[], [], [], [], [], [], [], [], []];

    for (let i = 0; i < rects.length; i += 1) {
        const rect = rects[i];
        const { center } = rect;
        let x;
        let y;

        if (center.x < targetRect.left) {
            x = 0;
        } else if (center.x <= targetRect.right) {
            x = 1;
        } else {
            x = 2;
        }

        if (center.y < targetRect.top) {
            y = 0;
        } else if (center.y <= targetRect.bottom) {
            y = 1;
        } else {
            y = 2;
        }

        const groupId = y * 3 + x;

        groups[groupId].push(rect);

        if ([0, 2, 6, 8].indexOf(groupId) !== -1) {
            const threshold = straightOverlapThreshold;

            if (rect.left <= targetRect.right - targetRect.width * threshold) {
                if (groupId === 2) {
                    groups[1].push(rect);
                } else if (groupId === 8) {
                    groups[7].push(rect);
                }
            }

            if (rect.right >= targetRect.left + targetRect.width * threshold) {
                if (groupId === 0) {
                    groups[1].push(rect);
                } else if (groupId === 6) {
                    groups[7].push(rect);
                }
            }

            if (rect.top <= targetRect.bottom - targetRect.height * threshold) {
                if (groupId === 6) {
                    groups[3].push(rect);
                } else if (groupId === 8) {
                    groups[5].push(rect);
                }
            }

            if (rect.bottom >= targetRect.top + targetRect.height * threshold) {
                if (groupId === 0) {
                    groups[3].push(rect);
                } else if (groupId === 2) {
                    groups[5].push(rect);
                }
            }
        }
    }

    return groups;
}

export function generateDistanceFunction(targetRect) {
    return {
        nearPlumbLineIsBetter(rect) {
            let d;

            if (rect.center.x < targetRect.center.x) {
                d = targetRect.center.x - rect.right;
            } else {
                d = rect.left - targetRect.center.x;
            }

            return d < 0 ? 0 : d;
        },

        nearHorizonIsBetter(rect) {
            let d;

            if (rect.center.y < targetRect.center.y) {
                d = targetRect.center.y - rect.bottom;
            } else {
                d = rect.top - targetRect.center.y;
            }

            return d < 0 ? 0 : d;
        },

        nearTargetLeftIsBetter(rect) {
            let d;

            if (rect.center.x < targetRect.center.x) {
                d = targetRect.left - rect.right;
            } else {
                d = rect.left - targetRect.left;
            }

            return d < 0 ? 0 : d;
        },

        nearTargetTopIsBetter(rect) {
            let d;

            if (rect.center.y < targetRect.center.y) {
                d = targetRect.top - rect.bottom;
            } else {
                d = rect.top - targetRect.top;
            }

            return d < 0 ? 0 : d;
        },

        topIsBetter(rect) {
            return rect.top;
        },

        bottomIsBetter(rect) {
            return -1 * rect.bottom;
        },

        leftIsBetter(rect) {
            return rect.left;
        },

        rightIsBetter(rect) {
            return -1 * rect.right;
        },
    };
}

export function prioritize(priorities) {
    let destPriority = null;

    for (let i = 0; i < priorities.length; i += 1) {
        if (priorities[i].group.length) {
            destPriority = priorities[i];
            break;
        }
    }

    if (!destPriority) {
        return null;
    }

    const destDistance = destPriority.distance;

    destPriority.group.sort((a, b) => {
        for (let i = 0; i < destDistance.length; i += 1) {
            const distance = destDistance[i];
            const delta = distance(a) - distance(b);

            if (delta) {
                return delta;
            }
        }

        return 0;
    });

    return destPriority.group;
}
