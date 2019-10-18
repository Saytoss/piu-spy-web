import _ from 'lodash/fp';
// import localForage from 'localforage';
//
import { GRADES } from 'constants/grades';

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

export const getProfiles = (profiles, data, ranking) => {
  const addHistoryData = profile => {
    const id = _.values(profile.resultsByGrade)[0][0].result.playerId;
    profile.ratingHistory =
      _.flow(
        _.find({ id }),
        _.get('ratingHistory')
      )(ranking) || [];
    profile.rankingHistory =
      _.flow(
        _.find({ id }),
        _.get('history'),
        history =>
          history && [...history, { place: _.get('place', _.last(history)), date: Date.now() }]
      )(ranking) || [];
    return profile;
  };
  return _.mapValues(addHistoryData, profiles);
};

export const getInitialProfiles = (data, tracklist) => {
  // console.log(tracklist);
  let profiles = {};
  const initializeProfile = id => {
    const resultsByLevel = _.fromPairs(Array.from({ length: 28 }).map((x, i) => [i + 1, []]));
    profiles[id] = { resultsByGrade: {}, resultsByLevel, lastResultDate: null };
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
    const resultsOfThisPlayer = _.filter({ playerId: result.playerId }, chart.results);
    if (resultsOfThisPlayer[0] === result) {
      // Only apply one result
      let bestGradeResult = result;
      if (resultsOfThisPlayer.length > 1) {
        bestGradeResult = resultsOfThisPlayer.sort(
          (a, b) => GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade)
        )[0];
      }
      profile.resultsByLevel[chart.chartLevel] = [
        ...(profile.resultsByLevel[chart.chartLevel] || []),
        { result: bestGradeResult, chart },
      ];
    }
    if (result.isExactDate && profile.lastResultDate < result.dateObject) {
      profile.lastResultDate = result.dateObject;
    }
  };
  data.forEach(chart => {
    chart.results.forEach(result => {
      addResultData(chart, result);
    });
  });

  const getBonusForGrade = (grade, level) =>
    (({ A: 30, 'A+': 25, S: 20, SS: 15 }[grade] * (1 + 2 ** (level / 4))) / 15);
  const getMinimumRatio = totalCharts =>
    Math.min(totalCharts, 1 + totalCharts / 20 + Math.sqrt(Math.max(totalCharts - 1, 0)) * 0.7) /
    totalCharts;

  profiles = _.mapValues(profile => {
    const neededGrades = ['A', 'A+', 'S', 'SS', 'SSS'];
    profile.progress = {
      double: {
        SS: {},
        S: {},
        'A+': {},
        A: {},
      },
      single: {
        SS: {},
        S: {},
        'A+': {},
        A: {},
      },
    };
    const gradeIncrementMap = {
      SSS: ['SS', 'S', 'A+', 'A'],
      SS: ['SS', 'S', 'A+', 'A'],
      S: ['S', 'A+', 'A'],
      'A+': ['A+', 'A'],
      A: ['A'],
    };
    const incrementLevel = (l, g, isS) => {
      const oneChartValue =
        1 / (isS ? tracklist.data.singlesLevels[l] : tracklist.data.doublesLevels[l]);
      const prog = isS ? profile.progress.single : profile.progress.double;
      prog[g][l] = prog[g][l] ? prog[g][l] + oneChartValue : oneChartValue;
    };
    _.keys(profile.resultsByLevel).forEach(level => {
      profile.resultsByLevel[level].forEach(res => {
        const thisGrade = res.result.grade;
        const thisPlayerId = res.result.playerId;
        const otherResults = res.chart.results.filter(r => r.playerId === thisPlayerId);
        if (otherResults.length > 1) {
          const sortedResults = otherResults.sort(
            (a, b) => neededGrades.indexOf(b.grade) - neededGrades.indexOf(a.grade)
          );
          if (sortedResults[0].grade !== thisGrade) {
            return; // Don't do anything when we have a different result with better grade
          }
        }
        const gradeIncArray = gradeIncrementMap[thisGrade];
        if (gradeIncArray) {
          gradeIncArray.forEach(gradeInc => {
            incrementLevel(level, gradeInc, res.chart.chartType === 'S');
          });
        }
      });
    });
    // console.log(profile.progress);
    ['single', 'double'].forEach(chartType => {
      profile.progress[`${chartType}-bonus`] = 0;
      _.keys(profile.progress[chartType]).forEach(grade => {
        profile.progress[chartType][`${grade}-bonus`] = 0;
        _.keys(profile.progress[chartType][grade]).forEach(level => {
          const ratio = profile.progress[chartType][grade][level];
          const totalCharts = tracklist.data[`${chartType}sLevels`][level];
          const minimumRatio = getMinimumRatio(totalCharts);
          const bonusCoefficient = Math.min(1, ratio / minimumRatio);
          const rawBonus = getBonusForGrade(grade, level);
          const bonus = rawBonus * bonusCoefficient;
          profile.progress[chartType][grade][`${level}-bonus`] = bonus;
          profile.progress[chartType][grade][`${level}-bonus-coef`] = bonusCoefficient;
          if (bonus >= profile.progress[chartType][`${grade}-bonus`]) {
            profile.progress[chartType][`${grade}-bonus`] = bonus;
            profile.progress[chartType][`${grade}-bonus-level`] = level;
            profile.progress[chartType][`${grade}-bonus-level-coef`] = bonusCoefficient;
          }
        });
        profile.progress[`${chartType}-bonus`] += profile.progress[chartType][`${grade}-bonus`];
      });
    });
    profile.progress.bonus = profile.progress['double-bonus'] + profile.progress['single-bonus'];
    // console.log(profile.progress);
    return profile;
  }, profiles);
  // const formatProfile = profile => {
  //   // console.log(profile);
  //   // const id = _.values(profile.resultsByGrade)[0][0].result.playerId;
  //   const name = _.values(profile.resultsByGrade)[0][0].result.nickname;
  //   return `${name} - ${profile.progress.bonus}
  // S: A (${profile.progress.single['A-bonus'].toFixed(1)}) A+ (${profile.progress.single[
  //     'A+-bonus'
  //   ].toFixed(1)}) S (${profile.progress.single['S-bonus'].toFixed(
  //     1
  //   )}) SS (${profile.progress.single['SS-bonus'].toFixed(1)})
  // D: A (${profile.progress.double['A-bonus'].toFixed(1)}) A+ (${profile.progress.double[
  //     'A+-bonus'
  //   ].toFixed(1)}) S (${profile.progress.double['S-bonus'].toFixed(
  //     1
  //   )}) SS (${profile.progress.double['SS-bonus'].toFixed(1)})`;
  // };
  // console.log(
  //   _.join(
  //     '\n',
  //     _.map(formatProfile, _.values(profiles).sort((a, b) => b.progress.bonus - a.progress.bonus))
  //   )
  // );
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
