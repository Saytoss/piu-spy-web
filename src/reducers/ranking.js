import _ from 'lodash/fp';
import localForage from 'localforage';

import { DEBUG } from 'constants/env';

const SET_RANKINGS = `RANKINGS/SET_RANKINGS`;
const RANKING_CHANGE_SET = `RANKINGS/RANKING_CHANGE_SET`;

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
            prevRating: _.get(playerOriginal.id, action.rankingsPointsMap),
          };
          if (!hasPrevList) {
            return player; // First time opening this thing and we didn't have any previous data
          }
          if (!_.includes(player.id, action.listPrev)) {
            return { ...player, change: 'NEW' };
          } else if (!_.includes(player.id, action.listNow)) {
            // Should NEVER happen, idk if this is possible
            return { ...player, change: '?' };
          } else {
            return {
              ...player,
              change: _.indexOf(player.id, action.listPrev) - _.indexOf(player.id, action.listNow),
            };
          }
        }, state.data),
      };
    default:
      return state;
  }
}

export const processBattles = ({ battles, profiles }) => {
  const dictChartElo = {};
  const getDictChartEloId = (score, enemyScore) =>
    `${score.playerId}vs${enemyScore.playerId}-${score.sharedChartId}-${score.isRank}`;
  const dictRatingDiff = {};
  const getDictRatingDiffId = score => `${score.playerId}-${score.sharedChartId}-${score.isRank}`;
  battles.forEach(([score, enemyScore, song]) => {
    // For each battle
    const p1 = profiles[score.playerId];
    const p2 = profiles[enemyScore.playerId];

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
        maxScore = Math.max(maxScore, score.score, enemyScore.score) + 10000;
      }
    }
    // Rating at the start of battle for this score
    if (!score.startingRating) score.startingRating = p1.rating;
    if (!enemyScore.startingRating) enemyScore.startingRating = p2.rating;

    // Counting the number of battles
    p1.battleCount++;
    p2.battleCount++;

    // This is one match between two players
    //// Elo formula
    // const r1 = score.startingRating;
    // const r2 = enemyScore.startingRating;
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
      kMinimizer =
        Math.max(
          Math.min(
            1,
            Math.max(
              100 - (100 * score.score) / maxScore,
              100 - (100 * enemyScore.score) / maxScore
            )
          ),
          0
        ) ** 2;
    }

    const K1 = kLevel * kMinimizer;
    const K2 = kLevel * kMinimizer;
    let dr1 = K1 * (S1 - E1);
    let dr2 = K2 * (S2 - E2);
    // Do not decrease rating if you have SSS - RIP zero-sum algorithm
    dr1 = dr1 < 0 && score.grade === 'SSS' ? 0 : dr1;
    dr2 = dr2 < 0 && enemyScore.grade === 'SSS' ? 0 : dr2;
    // Recording this value for display
    const baseEloId1 = getDictChartEloId(score, enemyScore);
    const baseEloId2 = getDictChartEloId(enemyScore, score);
    const baseEloP1 = dictChartElo[baseEloId1] || 0;
    const baseEloP2 = dictChartElo[baseEloId2] || 0;
    dictChartElo[baseEloId1] = dr1;
    dictChartElo[baseEloId2] = dr2;

    // Change rating as a result of this battle
    p1.rating = p1.rating + dr1 - baseEloP1;
    p2.rating = p2.rating + dr2 - baseEloP2;

    const ratingDiffId1 = getDictRatingDiffId(score);
    const ratingDiffId2 = getDictRatingDiffId(enemyScore);
    dictRatingDiff[ratingDiffId1] = (dictRatingDiff[ratingDiffId1] || 0) + dr1 - baseEloP1;
    dictRatingDiff[ratingDiffId2] = (dictRatingDiff[ratingDiffId2] || 0) + dr2 - baseEloP2;

    score.ratingDiff = dictRatingDiff[ratingDiffId1];
    score.ratingDiffLast = dr1 - baseEloP1;

    enemyScore.ratingDiff = dictRatingDiff[ratingDiffId2];
    enemyScore.ratingDiffLast = dr2 - baseEloP2;

    if (DEBUG) {
      // if (score.sharedChartId === 5292) {
      // if (song.song === 'Club Night') {
      // if (score.nickname === 'Liza' || enemyScore.nickname === 'Liza') {
      // if (!song.maxScore) {
      console.log(
        `${song.chartLabel} - ${song.song} (${song.sharedChartId}) - ${
          profiles[score.playerId].name
        } / ${profiles[enemyScore.playerId].name}
- ${score.score} / ${enemyScore.score} (${Math.floor(maxScore)} (${Math.floor(
          song.maxScore * scoreMultiplier
        )})) - R ${S1.toFixed(2)}/${S2.toFixed(2)} E ${E1.toFixed(2)} / ${E2.toFixed(2)}
- Rating ${r1.toFixed(2)} / ${r2.toFixed(2)} - ${dr1.toFixed(2)} / ${dr2.toFixed(
          2
        )} - K ${K1.toFixed(2)} ${K2.toFixed(2)}
- Base elo: ${baseEloP1.toFixed(2)} / ${baseEloP2.toFixed(2)}
- Elo change: ${(dr1 - baseEloP1).toFixed(2)} / ${(dr2 - baseEloP2).toFixed(2)}
- New base elo: ${dictChartElo[baseEloId1].toFixed(2)} / ${dictChartElo[baseEloId2].toFixed(2)}
- RD: ${dictRatingDiff[ratingDiffId1].toFixed(2)} / ${dictRatingDiff[ratingDiffId2].toFixed(2)}`
      );
    }
    // Rating floor
    p1.rating = Math.max(100, p1.rating);
    p2.rating = Math.max(100, p2.rating);

    const playersSorted = _.flow(
      _.keys,
      _.map(id => ({ id, rating: profiles[id].rating })),
      _.orderBy(['rating'], ['desc'])
    )(profiles);
    const battleDate =
      score.dateObject > enemyScore.dateObject ? score.dateObject : enemyScore.dateObject;
    playersSorted.forEach((player, index) => {
      const lastPlace = profiles[player.id].lastPlace;
      if (lastPlace !== index + 1) {
        profiles[player.id].rankingHistory.push({
          place: index + 1,
          date: battleDate.getTime(),
        });
        profiles[player.id].lastPlace = index + 1;
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
  });

  _.flow(
    _.keys,
    _.forEach(key => {
      profiles[key].id = _.toInteger(key);
      profiles[key].accuracy =
        profiles[key].countAcc > 0
          ? Math.round((profiles[key].sumAccuracy / profiles[key].countAcc) * 100) / 100
          : null;
      profiles[key].ratingRaw = profiles[key].rating;
      profiles[key].rating = Math.round(profiles[key].rating);
      profiles[key].rankingHistory = [
        ...profiles[key].rankingHistory,
        { place: _.get('place', _.last(profiles[key].rankingHistory)), date: Date.now() },
      ];
    })
  )(profiles);
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
      // console.log(listNow, listLastFetched, listLastChanged);
      // console.log(mapPointsNow, mapPointsLastFetched, mapPointsLastChanged);
      if (!_.isEqual(mapPointsNow, mapPointsLastFetched)) {
        // Between this fetch and last fetch there was a CHANGE in ranking
        localForage.setItem('lastChangedRankingPoints_v3', lastFetchedRanking);
        rankingsPointsMap = mapPointsLastFetched;
      }
      let listPrev = listLastChanged;
      if (!_.isEqual(listNow, listLastFetched)) {
        // Between this fetch and last fetch there was a CHANGE in ranking
        localForage.setItem('lastChangedRanking_v3', lastFetchedRanking);
        listPrev = listLastFetched;
      }
      dispatch({
        type: RANKING_CHANGE_SET,
        listNow,
        listPrev,
        rankingsPointsMap,
      });
      localForage.setItem('lastFetchedRanking_v3', ranking);
    } catch (error) {
      console.warn('Cannot get ranking from local storage', error);
    }
  };
};
