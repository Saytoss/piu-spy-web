import _ from 'lodash/fp';

import { achievements, initialAchievementState } from 'utils/achievements';
import { getExp, ranks as expRanks } from 'utils/exp';

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
  const initializeProfile = (id, name) => {
    const resultsByLevel = _.fromPairs(Array.from({ length: 28 }).map((x, i) => [i + 1, []]));
    profiles[id] = { name, resultsByGrade: {}, resultsByLevel, lastResultDate: null };
    profiles[id].achievements = _.flow(
      _.keys,
      _.map(achName => [
        achName,
        { ...(achievements[achName].initialState || initialAchievementState) },
      ]),
      _.fromPairs
    )(achievements);
    profiles[id].exp = 0;
  };
  const addResultData = (chart, result) => {
    if (!profiles[result.playerId]) {
      initializeProfile(result.playerId, result.nickname);
    }
    const profile = profiles[result.playerId];
    if (chart.chartType !== 'COOP') {
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
    }
    if (result.isExactDate && profile.lastResultDate < result.dateObject) {
      profile.lastResultDate = result.dateObject;
    }
    profile.achievements = _.mapValues.convert({ cap: false })((achState, achName) => {
      return achievements[achName].resultFunction(result, chart, achState, profile);
    }, profile.achievements);
    profile.exp += getExp(result, chart);
  };
  data.forEach(chart => {
    chart.results.forEach(result => {
      addResultData(chart, result);
    });
  });

  const getBonusForLevel = level => (30 * (1 + 2 ** (level / 4))) / 11;
  const getMinimumNumber = totalCharts =>
    Math.round(
      Math.min(totalCharts, 1 + totalCharts / 20 + Math.sqrt(Math.max(totalCharts - 1, 0)) * 0.7)
    );

  profiles = _.mapValues(profile => {
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
    return profile;
  }, profiles);
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
