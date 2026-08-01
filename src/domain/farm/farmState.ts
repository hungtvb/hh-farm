export type FarmState = Readonly<{
  day: number;
  coins: number;
  farmName: string;
}>;

const STARTING_DAY = 1;
const STARTING_COINS = 250;

export function createInitialFarmState(farmName = 'HH Farm'): FarmState {
  const normalizedName = farmName.trim();

  if (normalizedName.length === 0) {
    throw new Error('Farm name must not be empty.');
  }

  return {
    day: STARTING_DAY,
    coins: STARTING_COINS,
    farmName: normalizedName,
  };
}

export function advanceDay(state: FarmState): FarmState {
  return {
    ...state,
    day: state.day + 1,
  };
}
