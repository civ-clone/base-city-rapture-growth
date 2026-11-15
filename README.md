# base-city-rapture-growth

Growth while a city celebrates: a city that celebrates for a second turn running (or more) grows by one each turn,
while its player is allowed to grow cities this way, it has food to spare and no size cap holds it back. Its food
store is left as it was: this growth isn't paid for from it.

A library: it has no `main` and registers no rules.

## API

`lib/raptureGrowth`:

- `raptureGrowth(dependencies, options)`: the `onCelebrationChecked` hook for base-city-happiness-status'
  `cityStatusTurn`. Each city it's told celebrates again (`again`) grows by one when `raptureGrows` says so, on the
  yields the city was judged on. A ruleset passes it where it checks its cities' celebrations:

  ```ts
  cityStatusTurn(cityRegistry.getByPlayer(player), {
    // …
    onCelebrationChecked: raptureGrowth(
      { cityGrowthRegistry, cityImprovementRegistry },
      { FoodType: Food, allowed, growthLimits }
    ),
  });
  ```

- `raptureGrows(city, yields, dependencies, options)`: whether the city grows, changing nothing.
- `growByRapture(city, yields, dependencies, options)`: grows the city by one when `raptureGrows` says so, and gives
  whether it did. The city grows through `CityGrowth#grow`, so the ruleset's `Grow` rules put the new citizen to work
  and tell of the growth (its `city:grow` event, say) as for any growth, with `cause` as the reason. Whatever those
  rules do to the food store (empty it, half-fill it) is then undone.

`dependencies` are `{ cityGrowthRegistry?, cityImprovementRegistry? }`. `options`:

- `FoodType` (required): the city's food yield. Its total in the city's yields, net of what the city's citizens and
  units eat (the city's `Cost` rules), must be above 0.
- `allowed(city)` (required): whether the city's player may grow cities this way. It's asked as each city's turn comes,
  so the cities after one whose disorder brings a government down see the new government.
- `growthLimits`: the ruleset's size caps (base-city-growth-limit), checked at the size before growing. None by
  default.
- `maximumSize`: the size from which a city grows no more this way. None by default.
- `cause`: passed to `CityGrowth#grow`. core-city-happiness' `CelebrateLeader` rule class by default.

## When it runs

A city that starts celebrating only has its celebration recorded; it grows from the next turn on, for as long as the
celebration goes on. A celebration that stops and starts again starts over.

The hook runs where the ruleset checks its cities' celebrations. If that comes after the turn's food has gone into the
store, as it does when the celebrations are checked late in the player's turn, a city can grow from its food store and
from celebrating in the same turn.

## Following OpenCiv2

OpenCiv2 (github.com/richardpenman/civ2, `src/auto/city.cpp`) grows a city this way in `city_process_disorder`, when
the city meets the conditions to celebrate and was already celebrating:

- the government is above Fundamentalism, so a Republic or a Democracy (`allowed`);
- `size × food_per_citizen + settlers × settler_food < food` (`FoodType`);
- `city_needed_size_improvement(city) == 0`, the caps at 8 without an Aqueduct and 12 without a Sewer System, at the
  size before growing (`growthLimits`);
- and, with the game's bug fixes, `size < 127` (`maximumSize`).

It only adds 1 to the size; the food box is untouched. `city_process_turn` runs `city_process_food` (growth or
starvation from the box) before `city_process_disorder`, so both can happen in one turn.
