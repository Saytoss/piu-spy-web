import _ from 'lodash/fp';
// import localForage from 'localforage';
//
// import { DEBUG } from 'constants/env';

const SET_PROFILES = `PROFILES/SET_PROFILES`;
const SET_FILTER = `PROFILES/SET_FILTER`;
const RESET_FILTER = `PROFILES/RESET_FILTER`;

export const defaultFilter = {};

const initialState = {
  isLoading: false,
  data: [],
  filter: defaultFilter,
};

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case SET_PROFILES:
      return {
        ...state,
        data: action.data,
      };
    case SET_FILTER:
      return {
        ...state,
        filter: action.filter,
      };
    case RESET_FILTER:
      return {
        ...state,
        filter: defaultFilter,
      };
    default:
      return state;
  }
}

export const getProfiles = (data, ranking) => {
  const profiles = {};
  const initializeProfile = id => {
    const resultsByLevel = _.fromPairs(Array.from({ length: 28 }).map((x, i) => [i + 1, []]));
    const ratingHistory =
      _.flow(
        _.find({ id }),
        _.get('ratingHistory')
      )(ranking) || [];
    const rankingHistory =
      _.flow(
        _.find({ id }),
        _.get('history'),
        history =>
          history && [...history, { place: _.get('place', _.last(history)), date: Date.now() }]
      )(ranking) || [];
    profiles[id] = { resultsByGrade: {}, resultsByLevel, rankingHistory, ratingHistory };
  };
  const addResultData = (chart, result) => {
    if (!profiles[result.playerId]) {
      initializeProfile(result.playerId);
    }
    const profile = profiles[result.playerId];
    profile.resultsByGrade[result.grade] = [
      ...(profile.resultsByGrade[result.grade] || []),
      { result, chart },
    ];
    profile.resultsByLevel[chart.chartLevel] = [
      ...(profile.resultsByLevel[chart.chartLevel] || []),
      { result, chart },
    ];
  };
  data.forEach(chart => {
    chart.results.forEach(result => {
      addResultData(chart, result);
    });
  });
  return profiles;
};

export const setProfiles = data => ({
  type: SET_PROFILES,
  data,
});

export const setProfilesFilter = filter => ({
  type: SET_FILTER,
  filter,
});

export const resetProfilesFilter = () => ({
  type: RESET_FILTER,
});

export const calculateProfileData = profileId => (dispatch, getState) => {};
