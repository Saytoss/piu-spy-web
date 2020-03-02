import _ from 'lodash/fp';
import regression from 'regression';

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
    profile.accuracyByLevel = {};
    _.keys(profile.resultsByLevel).forEach(level => {
      profile.accuracyByLevel[level] = { count: 0, sum: 0, average: null };
      profile.resultsByLevel[level].forEach(res => {
        if (!res.result.isRank && res.result.accuracy) {
          profile.accuracyByLevel[level].count++;
          profile.accuracyByLevel[level].sum += res.result.accuracy;
        }

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
      profile.accuracyByLevel[level].average =
        profile.accuracyByLevel[level].count === 0
          ? null
          : profile.accuracyByLevel[level].sum / profile.accuracyByLevel[level].count;
    });
    const points = _.flow(
      _.toPairs,
      _.filter(([level, data]) => data.average && data.count > 10),
      _.map(([level, data]) => [_.toNumber(level), data.average])
    )(profile.accuracyByLevel);
    profile.accuracyPoints = points;
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
    const chartLevel = Number(chart.interpolatedDifficulty || chart.chartLevel);
    const maxPP = chartLevel ** 2.2 / 8; // divide by 4 for normalization, to align with previous elo versrion
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
        profile.pp.pp += 0.96 ** index * score.pp;
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

const interpolateDifficulties = (sharedCharts, processedProfiles) => {
  let newSharedCharts = _.mapValues(chart => {
    const datas = chart.results
      .map(r => {
        const profile = processedProfiles[r.playerId];
        if (!profile || !r.accuracy || r.isRank || _.isEmpty(profile.accuracyPoints)) {
          return null;
        }
        const accData = profile.accuracyByLevel[chart.chartLevel];
        if (!profile.accuracyPointsInterpolated) {
          let points = [...profile.accuracyPoints, [30, 0]];
          for (let i = profile.accuracyPoints[0][0]; i > 0; i--) {
            points = [[i, 100], ...points];
          }
          const result = regression('polynomial', points, 3);
          // console.log(result);
          const predict = x => {
            return (
              result.equation[0] +
              result.equation[1] * x +
              result.equation[2] * x * x +
              result.equation[3] * x * x * x
            );
          };

          // const f_1 = interpolate(profile.accuracyPoints);
          const f = x => {
            if (x <= profile.accuracyPoints[0][0]) {
              return 100;
            }
            // const calculated = f_1(x);
            const calculated = predict(x);
            return Math.max(0, Math.min(calculated, 100));
          };
          const yx = [];
          for (let i = 1; i <= 28; i += 0.05) {
            yx.push([i, f(i)]);
          }
          // console.log(JSON.stringify(yx, null, 1));
          profile.accuracyPointsInterpolated = yx;
        }
        const interpolatedPoint = _.find(
          pair => pair[1] < r.accuracy,
          profile.accuracyPointsInterpolated
        );
        return {
          id: r.playerId,
          accuracy: r.accuracy,
          avgAccuracy: accData.average,
          interpolatedDifficulty: interpolatedPoint && interpolatedPoint[0],
          weight:
            r.accuracy > 98
              ? 1 - (r.accuracy - 98) / (100 - 98)
              : r.accuracy < 80
              ? Math.max(0, (r.accuracy - 70) / (80 - 70))
              : 1,
        };
      })
      .filter(_.identity);
    const sums = datas.reduce(
      (acc, item) => {
        if (!item.interpolatedDifficulty) {
          return acc;
        }
        return {
          diffSum: acc.diffSum + item.interpolatedDifficulty * item.weight,
          weightSum: acc.weightSum + item.weight,
        };
      },
      { diffSum: 0, weightSum: 0 }
    );
    sums.diffSum += _.toNumber(chart.chartLevel);
    sums.weightSum += 1;
    const averageDifficulty = sums.diffSum / sums.weightSum;
    // console.log(chart.song, chart.chartLabel, JSON.stringify(datas), averageDifficulty);

    return {
      ...chart,
      interpolatedDifficulty: averageDifficulty,
    };
  }, sharedCharts);
  return newSharedCharts;
};

export const getProcessedProfiles = ({ profiles: originalProfiles, sharedCharts, tracklist }) => {
  // Calculate Progress achievements and bonus for starting Elo
  let profiles = postProcessProfiles(originalProfiles, tracklist);

  // Recalculate chart difficulty
  let newSharedCharts = interpolateDifficulties(sharedCharts, profiles);

  // Calculate ELO
  // const { logText, scoreInfo } = processBattles({ battles, profiles: processedProfiles, debug });

  // Calculate PP
  const { resultInfo, profiles: processedProfiles } = processPP({
    profiles,
    sharedCharts: newSharedCharts,
  });

  return { processedProfiles, resultInfo, sharedCharts: newSharedCharts };
};
