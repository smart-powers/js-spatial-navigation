import { generateDistanceFunction, getRect, partition, prioritize } from './utils';

export function navigate(target, direction, candidates, config) {
    if (!target || !direction || !candidates || !candidates.length) {
        return null;
    }

    const rects = [];

    for (let i = 0; i < candidates.length; i += 1) {
        const rect = getRect(candidates[i]);
        if (rect) {
            rects.push(rect);
        }
    }

    if (!rects.length) {
        return null;
    }

    const targetRect = getRect(target);

    if (!targetRect) {
        return null;
    }

    const distanceFunction = generateDistanceFunction(targetRect);
    const groups = partition(rects, targetRect, config.straightOverlapThreshold);
    const internalGroups = partition(groups[4], targetRect.center, config.straightOverlapThreshold);

    let priorities;

    switch (direction) {
        case 'left': {
            priorities = [
                {
                    group: internalGroups[0].concat(internalGroups[3]).concat(internalGroups[6]),
                    distance: [distanceFunction.nearPlumbLineIsBetter, distanceFunction.topIsBetter],
                },
                {
                    group: groups[3],
                    distance: [distanceFunction.nearPlumbLineIsBetter, distanceFunction.topIsBetter],
                },
                {
                    group: groups[0].concat(groups[6]),
                    distance: [
                        distanceFunction.nearHorizonIsBetter,
                        distanceFunction.rightIsBetter,
                        distanceFunction.nearTargetTopIsBetter,
                    ],
                },
            ];
            break;
        }

        case 'right': {
            priorities = [
                {
                    group: internalGroups[2].concat(internalGroups[5]).concat(internalGroups[8]),
                    distance: [distanceFunction.nearPlumbLineIsBetter, distanceFunction.topIsBetter],
                },
                {
                    group: groups[5],
                    distance: [distanceFunction.nearPlumbLineIsBetter, distanceFunction.topIsBetter],
                },
                {
                    group: groups[2].concat(groups[8]),
                    distance: [
                        distanceFunction.nearHorizonIsBetter,
                        distanceFunction.leftIsBetter,
                        distanceFunction.nearTargetTopIsBetter,
                    ],
                },
            ];
            break;
        }

        case 'up': {
            priorities = [
                {
                    group: internalGroups[0].concat(internalGroups[1]).concat(internalGroups[2]),
                    distance: [distanceFunction.nearHorizonIsBetter, distanceFunction.leftIsBetter],
                },
                {
                    group: groups[1],
                    distance: [distanceFunction.nearHorizonIsBetter, distanceFunction.leftIsBetter],
                },
                {
                    group: groups[0].concat(groups[2]),
                    distance: [
                        distanceFunction.nearPlumbLineIsBetter,
                        distanceFunction.bottomIsBetter,
                        distanceFunction.nearTargetLeftIsBetter,
                    ],
                },
            ];
            break;
        }

        case 'down': {
            priorities = [
                {
                    group: internalGroups[6].concat(internalGroups[7]).concat(internalGroups[8]),
                    distance: [distanceFunction.nearHorizonIsBetter, distanceFunction.leftIsBetter],
                },
                {
                    group: groups[7],
                    distance: [distanceFunction.nearHorizonIsBetter, distanceFunction.leftIsBetter],
                },
                {
                    group: groups[6].concat(groups[8]),
                    distance: [
                        distanceFunction.nearPlumbLineIsBetter,
                        distanceFunction.topIsBetter,
                        distanceFunction.nearTargetLeftIsBetter,
                    ],
                },
            ];
            break;
        }

        default: {
            return null;
        }
    }

    if (config.straightOnly) {
        priorities.pop();
    }

    const destGroup = prioritize(priorities);

    if (!destGroup) {
        return null;
    }

    let dest = null;

    if (
        config.rememberSource &&
        config.previous &&
        config.previous.destination === target &&
        config.previous.reverse === direction
    ) {
        for (let j = 0; j < destGroup.length; j += 1) {
            if (destGroup[j].element === config.previous.target) {
                dest = destGroup[j].element;
                break;
            }
        }
    }

    if (!dest) {
        dest = destGroup[0].element;
    }

    return dest;
}
