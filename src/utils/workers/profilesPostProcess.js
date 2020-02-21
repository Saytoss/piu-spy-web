import _ from 'lodash/fp';

import { ranks as expRanks } from 'utils/expRanks';

const postProcessProfiles = (profiles, tracklist) => {
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
    profile.achievementBonus = profile.progress.bonus;
    profile.accuracy =
      profile.countAcc > 0
        ? Math.round((profile.sumAccuracy / profile.countAcc) * 100) / 100
        : null;
    return profile;
  }, profiles);
  return newProfiles;
};

const processPP = ({ profiles, sharedCharts }) => {
  const resultInfo = {};
  for (const chartId in sharedCharts) {
    const chart = sharedCharts[chartId];
    const chartResults = chart.results;
    const chartLevel = Number(chart.chartLevel);
    const maxPP = chartLevel ** 2.2 / 7; // divide by 4 for normalization, to align with previous elo versrion
    if (chart.maxNonRankScore) {
      const maxScore = chart.maxNonRankScore;
      for (const result of chartResults) {
        if (!result.isRank && result.accuracyRaw && result.grade && maxScore) {
          let K2 = {
            SSS: 1,
            SS: 0.97,
            S: 0.95,
            'A+': 0.9,
            A: 0.84,
            B: 0.77,
            C: 0.63,
            D: 0.4,
            F: 0,
          }[result.grade];
          K2 = K2 === undefined ? 0.4 : K2;
          const K3 = Math.max(0, Math.min(1, result.scoreRaw / maxScore - 0.3) / 0.7);
          const K = K2 * K3;

          // Final PP value
          const pp = K * maxPP;
          // Record result data
          resultInfo[result.id] = {
            pp: {
              pp,
              k: K,
              kX: { K2, K3 },
              maxScore,
              maxPP,
              ppPotential: maxPP - pp,
              ppRatio: pp / maxPP,
              ppFixed: Number(pp.toFixed(1)),
            },
          };
          const profile = profiles[result.playerId];
          if (profile) {
            if (!profile.pp) {
              profile.pp = { scores: [], pp: 0 };
            }
            profile.pp.scores.push({
              pp_: Number(pp.toFixed(1)),
              s: chart.song,
              l: chart.chartLabel,
              pp,
              result,
              chart,
              k: { K2, K3, K },
            });
          }
        }
      }
    }
  }
  // Calculate total pp
  for (const playerId in profiles) {
    const profile = profiles[playerId];
    if (profile.pp) {
      profile.pp.scores.sort((a, b) => b.pp - a.pp);
      profile.pp.pp = 0;
      profile.pp.scores.forEach((score, index) => {
        profile.pp.pp += 0.95 ** index * score.pp;
      });
      profile.ratingRaw = profile.pp.pp;
    } else {
      profile.ratingRaw = 0;
    }
    profile.id = _.toInteger(playerId);
    profile.accuracy =
      profile.countAcc > 0
        ? Math.round((profile.sumAccuracy / profile.countAcc) * 100) / 100
        : null;
    profile.rating = Math.round(profile.ratingRaw);
  }
  return { resultInfo, profiles };
};

export const getProcessedProfiles = ({ profiles: originalProfiles, sharedCharts, tracklist }) => {
  // Calculate Progress achievements and bonus for starting Elo
  let profiles = postProcessProfiles(originalProfiles, tracklist);
  // Calculate ELO
  // const { logText, scoreInfo } = processBattles({ battles, profiles: processedProfiles, debug });
  // Calculate PP
  const { resultInfo, profiles: processedProfiles } = processPP({ profiles, sharedCharts });
  return { processedProfiles, resultInfo };
};
