"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raptureGrowth = exports.growByRapture = exports.raptureGrows = void 0;
const CityGrowthRegistry_1 = require("@civ-clone/core-city-growth/CityGrowthRegistry");
const CityImprovementRegistry_1 = require("@civ-clone/core-city-improvement/CityImprovementRegistry");
const growthLimit_1 = require("@civ-clone/base-city-growth-limit/lib/growthLimit");
const CelebrateLeader_1 = require("@civ-clone/core-city-happiness/Rules/CelebrateLeader");
const reduceYields_1 = require("@civ-clone/core-yield/lib/reduceYields");
/**
 * Whether `city`, celebrating for a second turn running (or more), grows by one: its player is `allowed` to, its food
 *  in `yields` is above 0 net of what it eats, no size cap holds it back, and it's below `maximumSize`. Changes nothing.
 *
 * OpenCiv2 (github.com/richardpenman/civ2, `src/auto/city.cpp` `city_process_disorder`): a city celebrating with its
 *  celebration already recorded grows when `government > GOV_FUNDAMENTALISM` (a Republic or a Democracy), `size *
 *  food_per_citizen + settlers * settler_food < food` and `city_needed_size_improvement(city) == 0`, and (with the
 *  game's bug fixes) `size < 127`.
 */
const raptureGrows = (city, yields, { cityGrowthRegistry = CityGrowthRegistry_1.instance, cityImprovementRegistry = CityImprovementRegistry_1.instance, }, { FoodType, allowed, growthLimits = [], maximumSize = Infinity, }) => {
    if ((0, reduceYields_1.reduceYield)(yields, FoodType) <= 0) {
        return false;
    }
    const cityGrowth = cityGrowthRegistry.getByCity(city);
    return (cityGrowth.size() < maximumSize &&
        (0, growthLimit_1.growthLimit)(cityGrowth, growthLimits, cityImprovementRegistry) === null &&
        allowed(city));
};
exports.raptureGrows = raptureGrows;
/**
 * Grows `city` by one when `raptureGrows` says so, and gives whether it did. The city grows through `CityGrowth#grow`,
 *  so its `Grow` rules put the new citizen to work and tell of it, as for any growth. The food the city has stored is
 *  as it was before: this growth isn't paid for from it, so whatever the `Grow` rules do to the store (empty it,
 *  half-fill it) is undone.
 */
const growByRapture = (city, yields, dependencies, options) => {
    var _a, _b;
    if (!(0, exports.raptureGrows)(city, yields, dependencies, options)) {
        return false;
    }
    const cityGrowth = ((_a = dependencies.cityGrowthRegistry) !== null && _a !== void 0 ? _a : CityGrowthRegistry_1.instance).getByCity(city), storedFood = cityGrowth.progress().value();
    cityGrowth.grow((_b = options.cause) !== null && _b !== void 0 ? _b : CelebrateLeader_1.default);
    cityGrowth.progress().set(storedFood, 'rapture-growth');
    return true;
};
exports.growByRapture = growByRapture;
/**
 * The `onCelebrationChecked` hook for base-city-happiness-status' `cityStatusTurn`: each city celebrating for a second
 *  turn running (or more) grows by one when `raptureGrows` says so, on the yields it was judged on.
 *
 * Run where the ruleset checks its cities' celebrations, so after the turn's food has gone into the store, and any
 *  growth or starvation from it: a city can grow both ways in one turn. OpenCiv2's `city_process_turn` runs
 *  `city_process_food`, then `city_process_disorder`, for each city.
 */
const raptureGrowth = (dependencies, options) => ({ city, yields }, again) => {
    if (!again) {
        return;
    }
    (0, exports.growByRapture)(city, yields, dependencies, options);
};
exports.raptureGrowth = raptureGrowth;
exports.default = exports.raptureGrowth;
//# sourceMappingURL=raptureGrowth.js.map