import _ from 'lodash/fp';

import { ranks as expRanks } from 'utils/exp';

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

export const postProcessProfiles = (profiles, tracklist) => {
  const getBonusForLevel = level => (30 * (1 + 2 ** (level / 4))) / 11;
  const getMinimumNumber = totalCharts =>
    Math.round(
      Math.min(totalCharts, 1 + totalCharts / 20 + Math.sqrt(Math.max(totalCharts - 1, 0)) * 0.7)
    );

  const newProfiles = _.mapValues(profile => {
    const neededGrades = ['A', 'A+', 'S', 'SS', 'SSS'];
    profile.expRank = _.findLast(rank => rank.threshold <= profile.exp, expRanks);
    profile.expRankNext = _.find(rank => rank.threshold > profile.exp, expRanks);
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
    const incrementLevel = (l, g, chartType) => {
      const prog =
        chartType === 'S' || chartType === 'SP'
          ? profile.progress.single
          : chartType === 'D' || chartType === 'DP'
          ? profile.progress.double
          : null;
      if (prog) {
        prog[g][l] = prog[g][l] ? prog[g][l] + 1 : 1;
      }
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
            incrementLevel(level, gradeInc, res.chart.chartType);
          });
        }
      });
    });
    ['single', 'double'].forEach(chartType => {
      profile.progress[`${chartType}-bonus`] = 0;
      _.keys(profile.progress[chartType]).forEach(grade => {
        profile.progress[chartType][`${grade}-bonus`] = 0;
        _.keys(profile.progress[chartType][grade]).forEach(level => {
          const number = profile.progress[chartType][grade][level];
          const totalCharts = tracklist.data[`${chartType}sLevels`][level];
          const minimumNumber = getMinimumNumber(totalCharts);
          const bonusCoefficientNumber = Math.min(1, number / minimumNumber);
          const rawBonus = getBonusForLevel(level);
          const bonus = rawBonus * bonusCoefficientNumber;
          profile.progress[chartType][grade][`${level}-bonus`] = bonus;
          profile.progress[chartType][grade][`${level}-bonus-coef`] = bonusCoefficientNumber;
          profile.progress[chartType][grade][`${level}-min-number`] = minimumNumber;
          profile.progress[chartType][grade][`${level}-achieved-number`] = number;
          if (bonus >= profile.progress[chartType][`${grade}-bonus`]) {
            profile.progress[chartType][`${grade}-bonus`] = bonus;
            profile.progress[chartType][`${grade}-bonus-level`] = level;
            profile.progress[chartType][`${grade}-bonus-level-coef`] = bonusCoefficientNumber;
            profile.progress[chartType][`${grade}-bonus-level-min-number`] = minimumNumber;
            profile.progress[chartType][`${grade}-bonus-level-achieved-number`] = number;
          }
        });
        profile.progress[`${chartType}-bonus`] += profile.progress[chartType][`${grade}-bonus`];
      });
    });
    profile.progress.bonus = profile.progress['double-bonus'] + profile.progress['single-bonus'];
    profile.rating = 850 + profile.progress.bonus;
    profile.accuracy =
      profile.countAcc > 0
        ? Math.round((profile.sumAccuracy / profile.countAcc) * 100) / 100
        : null;
    return profile;
  }, profiles);
  return newProfiles;
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
