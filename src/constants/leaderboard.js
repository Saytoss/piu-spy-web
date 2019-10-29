import _ from 'lodash/fp';

export const SORT = {
  DEFAULT: 'default',
  PROTAGONIST: 'protagonist',
  RANK_ASC: 'rankAsc',
  RANK_DESC: 'rankDesc',
  NEW_SCORES_PLAYER: 'newScoresPlayer',
};

export const CHART_MIN_MAX = [1, 28];
export const DURATION = {
  STD: 'Standard',
  SHORT: 'Short',
  REMIX: 'Remix',
  FULL: 'Full',
};
export const DURATION_DEFAULT = _.values(DURATION);
