import _ from 'lodash/fp';
import localForage from 'localforage';

import { DEBUG } from 'constants/env';

const SET_RANKINGS = `RANKINGS/SET_RANKINGS`;
const RANKING_CHANGE_SET = `RANKINGS/RANKING_CHANGE_SET`;

const isFullScore = score => {
  return (
    _.isInteger(score.perfect) &&
    _.isInteger(score.great) &&
    _.isInteger(score.good) &&
    _.isInteger(score.bad) &&
    _.isInteger(score.miss) &&
    _.isInteger(score.score)
  );
};

const getMaxScore = score => {
  const maxScoreAccuracy = ((score.score / score.accuracyRaw) * 100) / (score.isRank ? 1.2 : 1);

  return maxScoreAccuracy;
};

export default function reducer(state = {}, action) {
  switch (action.type) {
    case SET_RANKINGS:
      return {
        ...state,
        data: action.ranking,
      };
    case RANKING_CHANGE_SET:
      const hasPrevList = !_.isEmpty(action.listPrev);
      return {
        ...state,
        data: _.map(playerOriginal => {
          const player = {
            ...playerOriginal,
            prevRating: _.get(playerOriginal.name, action.rankingsPointsMap),
          };
          if (!hasPrevList) {
            return player; // First time opening this thing and we didn't have any previous data
          }
          if (!_.includes(player.name, action.listPrev)) {
            return { ...player, change: 'NEW' };
          } else if (!_.includes(player.name, action.listNow)) {
            // Should NEVER happen, idk if this is possible
            return { ...player, change: '?' };
          } else {
            return {
              ...player,
              change:
                _.indexOf(player.name, action.listPrev) - _.indexOf(player.name, action.listNow),
            };
          }
        }, state.data),
      };
    default:
      return state;
  }
}

export const getRankings = (data, { players }, profiles) => {
  const defaultInfo = {
    count: 0,
    battleCount: 0,
    countAcc: 0,
    // rating: 1000,
    grades: { F: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 0 },
    totalScore: { S: 0, D: 0, calories: 0 },
    sumAccuracy: 0,
    history: [],
    ratingHistory: [],
    lastPlace: null,
    lastBattleDate: 0,
  };
  const setupDefaultInfo = id => {
    return {
      ..._.cloneDeep(defaultInfo),
      rating: 850 + profiles[id].progress.bonus,
      exp: profiles[id].exp,
      expRank: profiles[id].expRank,
      //TODO: combine ranking and profiles
    };
  };
  const playerInfo = {};
  const battles = [];
  data.forEach(song => {
    const validResults = [];
    _.orderBy(['score'], ['desc'], song.results).forEach(score => {
      if (!score.nickname.includes('???')) {
        validResults.push(score);

        if (!playerInfo[score.playerId]) {
          playerInfo[score.playerId] = setupDefaultInfo(score.playerId);
        }
        const p1 = playerInfo[score.playerId];
        p1.count++;
        if (score.accuracy) {
          p1.countAcc++;
          p1.sumAccuracy += score.accuracy;
        }
        p1.totalScore[song.chartType] += score.score;
        score.calories && (p1.totalScore.calories += score.calories);
        p1.grades[score.grade.replace('+', '')]++;
      }
      if (!song.maxScore && isFullScore(score)) {
        song.maxScore = getMaxScore(score, song);
        song.maxScoreAccuracy = score.accuracyRaw;
      }
    });

    validResults.forEach((score, scoreIndex) => {
      const enemyScores = validResults.length > 1 ? validResults.slice(scoreIndex + 1) : [];

      enemyScores.forEach(enemyScore => {
        if (score.isRank === enemyScore.isRank && score.playerId !== enemyScore.playerId) {
          battles.push([score, enemyScore, song]);
        }
      });
    });
  });
  _.flow([
    // Apply battles chronologically instead of randomly
    _.sortBy(([s1, s2]) => Math.max(s1.dateObject.getTime(), s2.dateObject.getTime())),
    _.forEach(([score, enemyScore, song]) => {
      // For each battle
      if (!playerInfo[enemyScore.playerId]) {
        playerInfo[enemyScore.playerId] = setupDefaultInfo(enemyScore.playerId);
      }
      const p1 = playerInfo[score.playerId];
      const p2 = playerInfo[enemyScore.playerId];

      const scoreMultiplier = score.isRank ? 1.2 : 1;
      let maxScore = null;
      if (song.maxScore) {
        maxScore = song.maxScore * scoreMultiplier;
        if (
          Math.max(maxScore, score.score, enemyScore.score) !== maxScore &&
          !score.isRank &&
          (!score.isExactDate || !enemyScore.isExactDate)
        ) {
          maxScore *= 1.2;
          // Rank from machine best wasn't recognized most likely.
          // Increasing max score by 20% is fine
        }
        if (Math.max(maxScore, score.score, enemyScore.score) !== maxScore) {
          // If calculated max score isn't max score anyway, use current scores as max + cherry on top
          maxScore = Math.max(..._.map('score', song.results));
        }
      }
      // Rating at the start of battle for this score
      score.startingRating = p1.rating;
      enemyScore.startingRating = p2.rating;
      // Counting the number of battles
      p1.battleCount++;
      p2.battleCount++;

      // This is one match between two players
      //// Elo formula
      const r1 = p1.rating;
      const r2 = p2.rating;
      const R1 = 10 ** (r1 / 400);
      const R2 = 10 ** (r2 / 400);
      const E1 = R1 / (R1 + R2);
      const E2 = R2 / (R1 + R2);
      let A = score.score;
      let B = enemyScore.score;
      let S1, S2;
      if (A === B) {
        S1 = S2 = 0.5;
      } else if (maxScore && A !== 0 && B !== 0) {
        A = maxScore / A - 1;
        B = maxScore / B - 1;
        S1 = (B / (A + B) - 0.5) * 5 + 0.5;
        S2 = (A / (A + B) - 0.5) * 5 + 0.5;
      } else {
        S1 = A > B ? 1 : B < A ? 0 : 0.5;
        S2 = 1 - S1;
      }
      S1 = Math.max(0, Math.min(1, S1)); // Set strict boundaries to [0, 1]
      S2 = Math.max(0, Math.min(1, S2));

      const kRating1 = Math.max(0, Math.min(1, (r1 - 700) / 800));
      const kRating2 = Math.max(0, Math.min(1, (r2 - 700) / 800));
      const maxK1 = 30 + 20 * kRating1;
      const maxK2 = 30 + 20 * kRating2;
      const kLevel1 = Math.max(
        1,
        Math.min(maxK1, (song.chartLevel / 25) ** ((kRating1 - 0.5) * 5 + 2.5) * maxK1)
      );
      const kLevel2 = Math.max(
        1,
        Math.min(maxK2, (song.chartLevel / 25) ** ((kRating2 - 0.5) * 5 + 2.5) * maxK2)
      );
      const kLevel = Math.min(kLevel1, kLevel2);

      // When YOU vs ENEMY both have SS/SSS, and both scores are very close to SSS, this battle will NOT affect ELO too much
      let kMinimizer = 1;
      if (
        song.maxScore &&
        score.grade.startsWith('SS') &&
        enemyScore.grade.startsWith('SS') &&
        score.score / maxScore > 0.99 &&
        enemyScore.score / maxScore > 0.99
      ) {
        kMinimizer = Math.min(
          1,
          Math.max(100 - (100 * score.score) / maxScore, 100 - (100 * enemyScore.score) / maxScore)
        );
      }

      const K1 = kLevel * kMinimizer;
      const K2 = kLevel * kMinimizer;
      let dr1 = K1 * (S1 - E1);
      let dr2 = K2 * (S2 - E2);
      // Do not decrease rating if you have SSS - RIP zero-sum algorithm
      dr1 = dr1 < 0 && score.grade === 'SSS' ? 0 : dr1;
      dr2 = dr2 < 0 && enemyScore.grade === 'SSS' ? 0 : dr2;
      // Recording this value for display
      score.ratingDiff = (score.ratingDiff || 0) + dr1;
      enemyScore.ratingDiff = (enemyScore.ratingDiff || 0) + dr2;
      score.ratingDiffLast = dr1;
      enemyScore.ratingDiffLast = dr2;

      if (DEBUG && kMinimizer !== 1) {
        // if (song.song === 'Club Night') {
        // if (score.nickname === 'Liza' || enemyScore.nickname === 'Liza') {
        // if (!song.maxScore) {
        console.log(
          `${song.chartLabel} - ${score.nickname} / ${enemyScore.nickname} - ${song.song}`
        );
        console.log(
          `- ${score.score} / ${enemyScore.score} (${maxScore}) - R ${S1.toFixed(2)}/${S2.toFixed(
            2
          )} E ${E1.toFixed(2)} / ${E2.toFixed(2)}`
        );
        // console.log(`- old R ${S1old.toFixed(2)}/${S2old.toFixed(2)}`);
        console.log(
          `- Rating ${r1.toFixed(2)} / ${r2.toFixed(2)} - ${dr1.toFixed(2)} / ${dr2.toFixed(
            2
          )} - K ${K1.toFixed(2)} ${K2.toFixed(2)}`
        );
        // }
      }

      // Change rating as a result of this battle
      p1.rating = r1 + dr1;
      p2.rating = r2 + dr2;
      // Rating floor
      p1.rating = Math.max(100, p1.rating);
      p2.rating = Math.max(100, p2.rating);

      const playersSorted = _.flow(
        _.keys,
        _.map(id => ({ id, rating: playerInfo[id].rating })),
        _.orderBy(['rating'], ['desc'])
      )(playerInfo);
      const battleDate =
        score.dateObject > enemyScore.dateObject ? score.dateObject : enemyScore.dateObject;
      playersSorted.forEach((player, index) => {
        const lastPlace = playerInfo[player.id].lastPlace;
        if (lastPlace !== index + 1) {
          playerInfo[player.id].history.push({
            place: index + 1,
            date: battleDate.getTime(),
          });
          playerInfo[player.id].lastPlace = index + 1;
        }
      });

      const p1LastRating = _.last(p1.ratingHistory);
      const p2LastRating = _.last(p2.ratingHistory);
      if (p1LastRating !== p1.rating) {
        p1.ratingHistory.push({
          rating: p1.rating,
          date: battleDate.getTime(),
        });
      }
      if (p2LastRating !== p2.rating) {
        p2.ratingHistory.push({
          rating: p2.rating,
          date: battleDate.getTime(),
        });
      }
    }),
  ])(battles);

  const ranking = _.flow(
    _.keys,
    _.map(key => ({
      ..._.omit(['countAcc', 'sumAccuracy'], playerInfo[key]),
      id: _.toInteger(key),
      name: players[key].nickname,
      nameArcade: players[key].arcade_name,
      accuracy:
        playerInfo[key].countAcc > 0
          ? Math.round((playerInfo[key].sumAccuracy / playerInfo[key].countAcc) * 100) / 100
          : null,
      rating: Math.round(playerInfo[key].rating),
      ratingRaw: playerInfo[key].rating,
    })),
    _.remove(i => i.battleCount < 20),
    _.orderBy(['ratingRaw'], ['desc'])
  )(playerInfo);
  return ranking;
};

export const setRankingsAction = ranking => ({
  type: SET_RANKINGS,
  ranking,
});

const getListOfNames = _.map('id');
const getMapOfRatings = _.flow(
  _.map(q => [q.id, q.rating]),
  _.fromPairs
);
export const setRankings = ranking => {
  return async (dispatch, getState) => {
    dispatch(setRankingsAction(ranking));
    try {
      const [lastChangedRanking, lastChangedRankingPoints, lastFetchedRanking] = await Promise.all([
        localForage.getItem('lastChangedRanking_v3'),
        localForage.getItem('lastChangedRankingPoints_v3'),
        localForage.getItem('lastFetchedRanking_v3'),
      ]);
      const listNow = getListOfNames(ranking);
      const listLastFetched = getListOfNames(lastFetchedRanking);
      const listLastChanged = getListOfNames(lastChangedRanking);
      const mapPointsNow = getMapOfRatings(ranking);
      const mapPointsLastFetched = getMapOfRatings(lastFetchedRanking);
      const mapPointsLastChanged = getMapOfRatings(lastChangedRankingPoints);
      let rankingsPointsMap = mapPointsLastChanged;
      // console.log(mapPointsNow, mapPointsLastFetched, mapPointsLastChanged);
      if (!_.isEqual(mapPointsNow, mapPointsLastFetched)) {
        // Between this fetch and last fetch there was a CHANGE in ranking
        localForage.setItem('lastChangedRankingPoints_v2', lastFetchedRanking);
        rankingsPointsMap = mapPointsLastFetched;
      }
      let listPrev = listLastChanged;
      if (!_.isEqual(listNow, listLastFetched)) {
        // Between this fetch and last fetch there was a CHANGE in ranking
        localForage.setItem('lastChangedRanking_v2', lastFetchedRanking);
        listPrev = listLastFetched;
      }
      dispatch({
        type: RANKING_CHANGE_SET,
        listNow,
        listPrev,
        rankingsPointsMap,
      });
      localForage.setItem('lastFetchedRanking_v2', ranking);
      // console.log(listNow, listLastFetched, listLastChanged);
    } catch (error) {
      console.warn('Cannot get ranking from local storage', error);
    }
  };
};
