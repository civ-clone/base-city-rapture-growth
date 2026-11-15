import raptureGrowth, {
  RaptureGrowthOptions,
  growByRapture,
  raptureGrows,
} from '../lib/raptureGrowth';
import CelebrateLeader from '@civ-clone/core-city-happiness/Rules/CelebrateLeader';
import City from '@civ-clone/core-city/City';
import CityGrowth from '@civ-clone/core-city-growth/CityGrowth';
import CityGrowthRegistry from '@civ-clone/core-city-growth/CityGrowthRegistry';
import CityImprovement from '@civ-clone/core-city-improvement/CityImprovement';
import CityImprovementRegistry from '@civ-clone/core-city-improvement/CityImprovementRegistry';
import CityYield from '@civ-clone/core-city/Rules/Yield';
import CivilDisorder from '@civ-clone/core-city-happiness/Rules/CivilDisorder';
import Criterion from '@civ-clone/core-rule/Criterion';
import Effect from '@civ-clone/core-rule/Effect';
import Engine from '@civ-clone/core-engine/Engine';
import FoodStorage from '@civ-clone/core-city-growth/Yields/FoodStorage';
import Grow from '@civ-clone/core-city-growth/Rules/Grow';
import PendingEffectRegistry from '@civ-clone/core-pending-effect/PendingEffectRegistry';
import RuleRegistry from '@civ-clone/core-rule/RuleRegistry';
import Yield from '@civ-clone/core-yield/Yield';
import cityStatusTurn from '@civ-clone/base-city-happiness-status/lib/statusTurn';
import { registerCityStatusHandler } from '@civ-clone/base-city-happiness-status/lib/cityStatus';
import { expect } from 'chai';
import Turn from '@civ-clone/core-turn-based-game/Turn';
import setUpCity from '@civ-clone/core-city/tests/lib/setUpCity';

class Food extends Yield {}
class Other extends Yield {}
class Aqueduct extends CityImprovement {}
class Sewer extends CityImprovement {}

const setUp = async (size: number) => {
  const ruleRegistry = new RuleRegistry(),
    cityGrowthRegistry = new CityGrowthRegistry(),
    cityImprovementRegistry = new CityImprovementRegistry(),
    city = await setUpCity('city', ruleRegistry),
    cityGrowth = new CityGrowth(city, ruleRegistry),
    grown: unknown[] = [];

  cityGrowthRegistry.register(cityGrowth);

  // Size `size` before any `Grow` rule is registered.
  while (cityGrowth.size() < size) {
    cityGrowth.grow();
  }

  cityGrowth.progress().set(17);

  ruleRegistry.register(
    // As a ruleset's own growth does: the store empties, a Granary half-fills it, and the growth is told of.
    new Grow(new Effect((growth: CityGrowth): void => growth.empty())),
    new Grow(
      new Effect((growth: CityGrowth): void => growth.add(new FoodStorage(30)))
    ),
    new Grow(
      new Effect((growth: CityGrowth, cause: unknown): void => {
        grown.push(cause);
      })
    )
  );

  return {
    city,
    cityGrowth,
    cityGrowthRegistry,
    cityImprovementRegistry,
    grown,
    ruleRegistry,
  };
};

const options = (
  overrides: Partial<RaptureGrowthOptions> = {}
): RaptureGrowthOptions => ({
  FoodType: Food,
  allowed: (): boolean => true,
  // The original's caps: 8 without an Aqueduct, 12 without a Sewer System (`city_needed_size_improvement`).
  growthLimits: [
    [8, Aqueduct],
    [12, Sewer],
  ],
  maximumSize: 127,
  ...overrides,
});

describe('raptureGrows', (): void => {
  // OpenCiv2 `city_process_disorder`: `size * food_per_citizen + settlers * settler_food < food`, so the food net of
  //  what the city eats must be above 0; `city_needed_size_improvement(city) == 0`, checked at the size before growing
  //  (the cap holds at `cap <= size`); and, with the bug fixes, `size < 127`.
  (
    [
      ['food to spare', 5, [new Food(1)], [], {}, true],
      [
        'food net of what the city eats',
        5,
        [new Food(3), new Food(-2)],
        [],
        {},
        true,
      ],
      ['no food to spare', 5, [new Food(3), new Food(-3)], [], {}, false],
      ['less food than it eats', 5, [new Food(-1)], [], {}, false],
      ['only other yields', 5, [new Other(4)], [], {}, false],
      ['not allowed', 5, [new Food(2)], [], { allowed: () => false }, false],
      ['one below the first cap', 7, [new Food(2)], [], {}, true],
      ['at the first cap', 8, [new Food(2)], [], {}, false],
      [
        'at the first cap, with its improvement',
        8,
        [new Food(2)],
        [Aqueduct],
        {},
        true,
      ],
      [
        'at the second cap, with the first improvement',
        12,
        [new Food(2)],
        [Aqueduct],
        {},
        false,
      ],
      [
        'at the second cap, with both',
        12,
        [new Food(2)],
        [Aqueduct, Sewer],
        {},
        true,
      ],
      [
        'one below the largest size',
        126,
        [new Food(2)],
        [Aqueduct, Sewer],
        {},
        true,
      ],
      ['at the largest size', 127, [new Food(2)], [Aqueduct, Sewer], {}, false],
      [
        'no caps or largest size given',
        127,
        [new Food(2)],
        [],
        { growthLimits: undefined, maximumSize: undefined },
        true,
      ],
    ] as [
      string,
      number,
      Yield[],
      (typeof CityImprovement)[],
      Partial<RaptureGrowthOptions>,
      boolean
    ][]
  ).forEach(([description, size, yields, Improvements, overrides, expected]) =>
    it(`${
      expected ? 'grows' : "doesn't grow"
    } a size ${size} city: ${description}`, async (): Promise<void> => {
      const {
        city,
        cityGrowthRegistry,
        cityImprovementRegistry,
        ruleRegistry,
      } = await setUp(size);

      Improvements.forEach((Improvement) =>
        cityImprovementRegistry.register(new Improvement(city, ruleRegistry))
      );

      expect(
        raptureGrows(
          city,
          yields,
          { cityGrowthRegistry, cityImprovementRegistry },
          options(overrides)
        )
      ).to.equal(expected);
    })
  );

  it('asks `allowed` about the city', async (): Promise<void> => {
    const { city, cityGrowthRegistry, cityImprovementRegistry } = await setUp(
        5
      ),
      asked: City[] = [];

    raptureGrows(
      city,
      [new Food(1)],
      { cityGrowthRegistry, cityImprovementRegistry },
      options({
        allowed: (c: City): boolean => {
          asked.push(c);

          return true;
        },
      })
    );

    expect(asked.length).to.equal(1);
    expect(asked[0] === city).to.true;
  });
});

describe('growByRapture', (): void => {
  // OpenCiv2 `city_process_disorder` only does `cities[city].size++`: the food box is left as it is.
  it('grows the city by one through its `Grow` rules, leaving its food store as it was', async (): Promise<void> => {
    const {
      city,
      cityGrowth,
      cityGrowthRegistry,
      cityImprovementRegistry,
      grown,
    } = await setUp(5);

    expect(
      growByRapture(
        city,
        [new Food(2)],
        { cityGrowthRegistry, cityImprovementRegistry },
        options()
      )
    ).to.true;
    expect(cityGrowth.size()).to.equal(6);
    expect(cityGrowth.progress().value()).to.equal(17);
    expect(grown).to.deep.equal([CelebrateLeader]);
  });

  it('passes the cause it is given to the `Grow` rules', async (): Promise<void> => {
    const { city, cityGrowthRegistry, cityImprovementRegistry, grown } =
        await setUp(5),
      cause = {};

    growByRapture(
      city,
      [new Food(2)],
      { cityGrowthRegistry, cityImprovementRegistry },
      options({ cause })
    );

    expect(grown.length).to.equal(1);
    expect(grown[0] === cause).to.true;
  });

  it("changes nothing when the city doesn't grow", async (): Promise<void> => {
    const {
      city,
      cityGrowth,
      cityGrowthRegistry,
      cityImprovementRegistry,
      grown,
    } = await setUp(8);

    expect(
      growByRapture(
        city,
        [new Food(2)],
        { cityGrowthRegistry, cityImprovementRegistry },
        options()
      )
    ).to.false;
    expect(cityGrowth.size()).to.equal(8);
    expect(cityGrowth.progress().value()).to.equal(17);
    expect(grown).to.deep.equal([]);
  });
});

describe('raptureGrowth', (): void => {
  it('grows a city only when it celebrates again', async (): Promise<void> => {
    const { city, cityGrowth, cityGrowthRegistry, cityImprovementRegistry } =
        await setUp(5),
      hook = raptureGrowth(
        { cityGrowthRegistry, cityImprovementRegistry },
        options()
      ),
      check = {
        city,
        yields: [new Food(2)],
        disorder: false,
        celebrating: true,
        recordedDisorder: null,
        recordedCelebration: null,
      };

    hook(check, false);

    expect(cityGrowth.size()).to.equal(5);

    hook(check, true);

    expect(cityGrowth.size()).to.equal(6);
  });

  it('grows a city at most once a turn', async (): Promise<void> => {
    const { city, cityGrowth, cityGrowthRegistry, cityImprovementRegistry } =
        await setUp(5),
      turn = new Turn(),
      hook = raptureGrowth(
        { cityGrowthRegistry, cityImprovementRegistry, turn },
        options()
      ),
      check = {
        city,
        yields: [new Food(2)],
        disorder: false,
        celebrating: true,
        recordedDisorder: null,
        recordedCelebration: null,
      };

    hook(check, true);
    hook(check, true);

    expect(cityGrowth.size()).to.equal(6);

    turn.increment();
    hook(check, true);

    expect(cityGrowth.size()).to.equal(7);
  });

  // OpenCiv2 `city_process_disorder`: the first turn a city celebrates only sets `CITYF_CELEBRATING`; from the second
  //  turn running it grows, each turn, until the celebration stops. A celebration that starts again starts over.
  it("as `cityStatusTurn`'s hook, grows a city on each turn it celebrates after the first", async (): Promise<void> => {
    const {
        city,
        cityGrowth,
        cityGrowthRegistry,
        cityImprovementRegistry,
        ruleRegistry,
      } = await setUp(5),
      pendingEffects = new PendingEffectRegistry(),
      engine = new Engine(),
      turn = new Turn();

    registerCityStatusHandler(
      'test:disorder',
      'test:order-restored',
      pendingEffects,
      engine
    );
    registerCityStatusHandler(
      'test:celebration',
      'test:celebration-ended',
      pendingEffects,
      engine
    );

    let celebrating = false;

    ruleRegistry.register(
      new CityYield(new Effect((): Yield => new Food(2))),
      new CivilDisorder(new Effect((): boolean => false)),
      new CelebrateLeader(
        new Criterion((): boolean => celebrating),
        new Effect((): boolean => true)
      )
    );

    const sizes = [true, true, true, false, true, true].map(
      (celebrates: boolean): number => {
        celebrating = celebrates;

        turn.increment();

        cityStatusTurn([city], {
          disorderHandler: 'test:disorder',
          celebrationHandler: 'test:celebration',
          pendingEffects,
          ruleRegistry,
          engine,
          onCelebrationChecked: raptureGrowth(
            { cityGrowthRegistry, cityImprovementRegistry, turn },
            options()
          ),
        });

        return cityGrowth.size();
      }
    );

    expect(sizes).to.deep.equal([5, 6, 7, 7, 7, 8]);
    expect(cityGrowth.progress().value()).to.equal(17);
  });
});
