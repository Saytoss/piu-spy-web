import _ from 'lodash/fp';
// import localForage from 'localforage';
//
// import { DEBUG } from 'constants/env';

const SET_PROFILES = `PROFILES/SET_PROFILES`;

export default function reducer(state = { data: {} }, action) {
  switch (action.type) {
    case SET_PROFILES:
      return {
        ...state,
        data: action.data,
      };
    default:
      return state;
  }
}

export const getProfiles = (data, ranking) => {
  const profiles = {};
  const initializeProfile = nickname => {
    const rankingHistory = _.flow(
      _.find({ name: nickname }),
      _.get('history'),
      history =>
        history && [...history, { place: _.get('place', _.last(history)), date: Date.now() }]
    )(ranking);
    profiles[nickname] = { resultsByGrade: {}, resultsByLevel: {}, rankingHistory };
  };
  const addResultData = (chart, result) => {
    if (!profiles[result.nickname]) {
      initializeProfile(result.nickname);
    }
    const profile = profiles[result.nickname];
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
  // console.log(profiles);
  return profiles;
};

export const setProfilesAction = data => ({
  type: SET_PROFILES,
  data,
});

export const setProfiles = ranking => {
  return async (dispatch, getState) => {
    dispatch(setProfilesAction(ranking));
  };
};
