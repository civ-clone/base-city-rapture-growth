import {
  CityGrowthRegistry,
  instance as cityGrowthRegistryInstance,
} from '@civ-clone/core-city-growth/CityGrowthRegistry';
import {
  CityImprovementRegistry,
  instance as cityImprovementRegistryInstance,
} from '@civ-clone/core-city-improvement/CityImprovementRegistry';
import {
  GrowthLimit,
  growthLimit,
} from '@civ-clone/base-city-growth-limit/lib/growthLimit';
import CelebrateLeader from '@civ-clone/core-city-happiness/Rules/CelebrateLeader';
import City from '@civ-clone/core-city/City';
import { CityStatusCheck } from '@civ-clone/base-city-happiness-status/lib/statusTurn';
import Yield from '@civ-clone/core-yield/Yield';
import { reduceYield } from '@civ-clone/core-yield/lib/reduceYields';

export interface RaptureGrowthDependencies {
  cityGrowthRegistry?: CityGrowthRegistry;
  cityImprovementRegistry?: CityImprovementRegistry;
}

export interface RaptureGrowthOptions {
  /**
   * The city's food yield. Its total in the city's yields, net of what the city's citizens and units eat (the city's
   *  `Cost` rules), must be above 0 for the city to grow.
   */
  FoodType: typeof Yield;
  /**
   * Whether the city's player may grow cities this way, asked as the city's turn comes (so a government that falls
   *  part-way through a player's cities is seen by the cities after it). The original allows a Republic or a
   *  Democracy.
   */
  allowed: (city: City) => boolean;
  /**
   * The ruleset's size caps (base-city-growth-limit), checked at the city's size before it grows: a city held back by
   *  one doesn't grow. None by default.
   */
  growthLimits?: GrowthLimit[];
  /** The size from which a city grows no more this way. None by default; the original stops at 127. */
  maximumSize?: number;
  /**
   * Why the city grew, passed to `CityGrowth#grow` and so to the `Grow` rules (and to a ruleset's `city:grow` event).
   *  `CelebrateLeader` by default.
   */
  cause?: unknown;
}

/**
 * Whether `city`, celebrating for a second turn running (or more), grows by one: its player is `allowed` to, its food
 *  in `yields` is above 0 net of what it eats, no size cap holds it back, and it's below `maximumSize`. Changes nothing.
 *
 * OpenCiv2 (github.com/richardpenman/civ2, `src/auto/city.cpp` `city_process_disorder`): a city celebrating with its
 *  celebration already recorded grows when `government > GOV_FUNDAMENTALISM` (a Republic or a Democracy), `size *
 *  food_per_citizen + settlers * settler_food < food` and `city_needed_size_improvement(city) == 0`, and (with the
 *  game's bug fixes) `size < 127`.
 */
export const raptureGrows = (
  city: City,
  yields: Yield[],
  {
    cityGrowthRegistry = cityGrowthRegistryInstance,
    cityImprovementRegistry = cityImprovementRegistryInstance,
  }: RaptureGrowthDependencies,
  {
    FoodType,
    allowed,
    growthLimits = [],
    maximumSize = Infinity,
  }: RaptureGrowthOptions
): boolean => {
  if (reduceYield(yields, FoodType) <= 0) {
    return false;
  }

  const cityGrowth = cityGrowthRegistry.getByCity(city);

  return (
    cityGrowth.size() < maximumSize &&
    growthLimit(cityGrowth, growthLimits, cityImprovementRegistry) === null &&
    allowed(city)
  );
};

/**
 * Grows `city` by one when `raptureGrows` says so, and gives whether it did. The city grows through `CityGrowth#grow`,
 *  so its `Grow` rules put the new citizen to work and tell of it, as for any growth. The food the city has stored is
 *  as it was before: this growth isn't paid for from it, so whatever the `Grow` rules do to the store (empty it,
 *  half-fill it) is undone.
 */
export const growByRapture = (
  city: City,
  yields: Yield[],
  dependencies: RaptureGrowthDependencies,
  options: RaptureGrowthOptions
): boolean => {
  if (!raptureGrows(city, yields, dependencies, options)) {
    return false;
  }

  const cityGrowth = (
      dependencies.cityGrowthRegistry ?? cityGrowthRegistryInstance
    ).getByCity(city),
    storedFood = cityGrowth.progress().value();

  cityGrowth.grow(options.cause ?? CelebrateLeader);
  cityGrowth.progress().set(storedFood, 'rapture-growth');

  return true;
};

/**
 * The `onCelebrationChecked` hook for base-city-happiness-status' `cityStatusTurn`: each city celebrating for a second
 *  turn running (or more) grows by one when `raptureGrows` says so, on the yields it was judged on.
 *
 * Run where the ruleset checks its cities' celebrations, so after the turn's food has gone into the store, and any
 *  growth or starvation from it: a city can grow both ways in one turn. OpenCiv2's `city_process_turn` runs
 *  `city_process_food`, then `city_process_disorder`, for each city.
 */
export const raptureGrowth =
  (
    dependencies: RaptureGrowthDependencies,
    options: RaptureGrowthOptions
  ): ((check: CityStatusCheck, again: boolean) => void) =>
  ({ city, yields }: CityStatusCheck, again: boolean): void => {
    if (!again) {
      return;
    }

    growByRapture(city, yields, dependencies, options);
  };

export default raptureGrowth;
