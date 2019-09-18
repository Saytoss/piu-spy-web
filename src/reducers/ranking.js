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

const getMaxScore = (score, song) => {
  const maxCombo = score.perfect + score.great + score.good + score.bad + score.miss;
  let maxScore = maxCombo * 1000 + (maxCombo - 50) * 1000; // all perfects + 51 combo bonus
  if (song.chartLevel > 10) {
    maxScore *= song.chartLevel / 10; // Level multiplier
  }
  if (song.chartType === 'D') {
    maxScore *= 1.2; // Double multiplier
  }
  maxScore += 300000; // SSS bonus
  return maxScore;
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

export const getRankings = data => {
  const defaultInfo = {
    count: 0,
    battleCount: 0,
    countAcc: 0,
    rating: 1000,
    grades: { F: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 0 },
    totalScore: { S: 0, D: 0 },
    sumAccuracy: 0,
    history: [],
    lastPlace: null,
  };
  const playerInfo = {};
  const battles = [];
  data.forEach(song => {
    const validResults = [];
    _.orderBy(['score'], ['desc'], song.results).forEach(score => {
      if (!score.nickname.includes('???')) {
        validResults.push(score);

        if (!playerInfo[score.nickname]) {
          playerInfo[score.nickname] = _.cloneDeep(defaultInfo);
        }

        playerInfo[score.nickname].count++;
        if (score.accuracy) {
          playerInfo[score.nickname].countAcc++;
          playerInfo[score.nickname].sumAccuracy += score.accuracy;
        }
        playerInfo[score.nickname].totalScore[song.chartType] += score.score;
        playerInfo[score.nickname].grades[score.grade.replace('+', '')]++;
      }
      if (isFullScore(score)) {
        song.maxScore = getMaxScore(score, song);
      }
    });

    validResults.forEach((score, scoreIndex) => {
      const enemyScores = validResults.length > 1 ? validResults.slice(scoreIndex + 1) : [];

      enemyScores.forEach(enemyScore => {
        if (score.isRank === enemyScore.isRank && score.nickname !== enemyScore.nickname) {
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
      if (!playerInfo[enemyScore.nickname]) {
        playerInfo[enemyScore.nickname] = _.cloneDeep(defaultInfo);
      }

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
      // console.log(song.maxScore * scoreMultiplier, score.score, enemyScore.score);
      // Rating at the start of battle for this score
      score.startingRating = playerInfo[score.nickname].rating;
      enemyScore.startingRating = playerInfo[enemyScore.nickname].rating;
      // Counting the number of battles
      playerInfo[score.nickname].battleCount++;
      playerInfo[enemyScore.nickname].battleCount++;

      // This is one match between two players
      //// Elo formula
      const r1 = playerInfo[score.nickname].rating;
      const r2 = playerInfo[enemyScore.nickname].rating;
      const R1 = 10 ** (r1 / 400);
      const R2 = 10 ** (r2 / 400);
      const E1 = R1 / (R1 + R2);
      const E2 = R2 / (R1 + R2);
      // S1/S2 is the factor of winning
      // S1 = 1  S2 = 0  -- player 1 wins
      // S1 = 0.5  S2 = 0.5  -- draw
      // I'm using difference in score to get this value, it ranges from 0 from 1
      // Current formula assigns 100% win if you have at least ~15% more score than the other player
      // 3.000 vs 3.500 score -- 0 / 1 win percentage -- clear win for player 2
      // 3.000 vs 3.300 score -- 0.17 / 0.83 win percentage -- ranking is not affected as strongly as 0 / 1
      // 3.000 vs 3.100 score -- 0.38 / 0.62 win percentage -- almost draw
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
        // console.log('////////// NO MAX SCORE /////////////');
        S1 = A > B ? 1 : B < A ? 0 : 0.5;
        S2 = 1 - S1;
      }
      S1 = Math.max(0, Math.min(1, S1)); // Set strict boundaries to [0, 1]
      S2 = Math.max(0, Math.min(1, S2));
      // S1old = Math.max(0, Math.min(1, S1old)); // Set strict boundaries to [0, 1]
      // S2old = Math.max(0, Math.min(1, S2old));
      // K is the coeficient that decides how strongly this match affects rating
      // Higher level -- affects more
      // More playcount -- affects less (just to make first matches place people faster)
      // const k1pow = Math.min(1, playerInfo[score.nickname].battleCount / 100) * 0.3; // battlecount 0 -> 150 => results in 0 -> 0.5 value here
      // const k2pow = Math.min(1, playerInfo[enemyScore.nickname].battleCount / 100) * 0.3; // battlecount 0 -> 150 => results in 0 -> 0.5 value here

      let kRatingDiff = Math.abs(E1 - E2) + 0.6;
      // prettier-ignore
      if ((S1 - E1 > 0) === (E1 < 0.5) && Math.abs(E1 - E2) > 0.1) {
        const difference = Math.abs(E1 - E2) / 2.6;
        kRatingDiff *= 1 - difference; // When someone with lower rank wins against someone with higher rank
      }
      const kRating1 = Math.max(0, Math.min(1, (r1 - 500) / 1000));
      const kRating2 = Math.max(0, Math.min(1, (r2 - 500) / 1000));
      const maxK1 = 50 + 40 * kRating1;
      const maxK2 = 50 + 40 * kRating2;
      const kLevel1 = Math.max(
        1,
        Math.min(maxK1, (song.chartLevel / 25) ** ((kRating1 - 0.5) * 5 + 2.5) * maxK1)
      );
      const kLevel2 = Math.max(
        1,
        Math.min(maxK2, (song.chartLevel / 25) ** ((kRating2 - 0.5) * 5 + 2.5) * maxK2)
      );

      const K1 = kLevel1 / kRatingDiff;
      const K2 = kLevel2 / kRatingDiff;
      // const K1 = (kLevel + (1 - kRating1) * (maxK - kLevel)) / kRatingDiff;
      // const K2 = (kLevel + (1 - kRating2) * (maxK - kLevel)) / kRatingDiff;
      // const K1D = (Math.max(r1 - 600, 0) / 1500 + 1) ** 3 / 2;
      // const K2D = (Math.max(r2 - 600, 0) / 1500 + 1) ** 3 / 2;
      // const K1 = Math.min(20, Math.max(4, song.chartLevel - 4)) ** (2 - k1pow) / K1D / RD;
      // const K2 = Math.min(20, Math.max(4, song.chartLevel - 4)) ** (2 - k2pow) / K2D / RD;
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

      if (DEBUG) {
        // if (song.song === 'Club Night') {
        // if (score.nickname === 'Liza' || enemyScore.nickname === 'Liza') {
        // if (!song.maxScore) {
        // console.log(
        //   `${song.chartLabel} - ${score.nickname} / ${enemyScore.nickname} - ${song.song}`
        // );
        // console.log(
        //   `- ${score.score} / ${enemyScore.score} (${maxScore}) - R ${S1.toFixed(2)}/${S2.toFixed(
        //     2
        //   )} E ${E1.toFixed(2)} / ${E2.toFixed(2)}`
        // );
        // // console.log(`- old R ${S1old.toFixed(2)}/${S2old.toFixed(2)}`);
        // console.log(
        //   `- Rating ${r1.toFixed(2)} / ${r2.toFixed(2)} - ${dr1.toFixed(2)} / ${dr2.toFixed(
        //     2
        //   )} - K ${K1.toFixed(2)} ${K2.toFixed(2)} RD ${kRatingDiff.toFixed(1)}`
        // );
        // }
      }

      // Change rating as a result of this battle
      playerInfo[score.nickname].rating = r1 + dr1;
      playerInfo[enemyScore.nickname].rating = r2 + dr2;
      // Rating floor
      playerInfo[score.nickname].rating = Math.max(100, playerInfo[score.nickname].rating);
      playerInfo[enemyScore.nickname].rating = Math.max(
        100,
        playerInfo[enemyScore.nickname].rating
      );

      const namesSorted = _.flow(
        _.keys,
        _.map(name => ({ name, rating: playerInfo[name].rating })),
        _.orderBy(['rating'], ['desc']),
        _.map('name')
      )(playerInfo);
      const p1Place = namesSorted.indexOf(score.nickname) + 1;
      const p2Place = namesSorted.indexOf(enemyScore.nickname) + 1;
      const battleDate =
        score.dateObject > enemyScore.dateObject ? score.dateObject : enemyScore.dateObject;
      if (
        (playerInfo[score.nickname].lastPlace !== p1Place &&
          playerInfo[score.nickname].battleCount > 20) ||
        (playerInfo[score.nickname].battleCount === 21 &&
          !playerInfo[score.nickname].history.length)
      ) {
        // Place in rankings changed!
        playerInfo[score.nickname].history.push({
          place: p1Place,
          date: battleDate.getTime(),
        });
      }
      if (
        (playerInfo[enemyScore.nickname].lastPlace !== p2Place &&
          playerInfo[enemyScore.nickname].battleCount > 20) ||
        (playerInfo[enemyScore.nickname].battleCount === 21 &&
          !playerInfo[enemyScore.nickname].history.length)
      ) {
        playerInfo[enemyScore.nickname].history.push({
          place: p2Place,
          date: battleDate.getTime(),
        });
      }
      playerInfo[score.nickname].lastPlace = p1Place;
      playerInfo[enemyScore.nickname].lastPlace = p2Place;
    }),
  ])(battles);

  const ranking = _.flow(
    _.keys,
    _.map(key => ({
      ..._.omit(['countAcc', 'sumAccuracy'], playerInfo[key]),
      name: key,
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

const getListOfNames = _.map('name');
const getMapOfRatings = _.flow(
  _.map(q => [q.name, q.rating]),
  _.fromPairs
);
export const setRankings = ranking => {
  return async (dispatch, getState) => {
    dispatch(setRankingsAction(ranking));
    try {
      const [lastChangedRanking, lastChangedRankingPoints, lastFetchedRanking] = await Promise.all([
        localForage.getItem('lastChangedRanking'),
        localForage.getItem('lastChangedRankingPoints'),
        localForage.getItem('lastFetchedRanking'),
      ]);
      const listNow = getListOfNames(ranking);
      const listLastFetched = getListOfNames(lastFetchedRanking);
      const listLastChanged = getListOfNames(lastChangedRanking);
      const mapPointsNow = getMapOfRatings(ranking);
      const mapPointsLastFetched = getMapOfRatings(lastFetchedRanking);
      const mapPointsLastChanged = getMapOfRatings(lastChangedRankingPoints);
      let rankingsPointsMap = mapPointsLastChanged;
      if (!_.isEqual(mapPointsNow, mapPointsLastFetched)) {
        // Between this fetch and last fetch there was a CHANGE in ranking
        localForage.setItem('lastChangedRankingPoints', lastFetchedRanking);
        rankingsPointsMap = mapPointsLastFetched;
      }
      let listPrev = listLastChanged;
      if (!_.isEqual(listNow, listLastFetched)) {
        // Between this fetch and last fetch there was a CHANGE in ranking
        localForage.setItem('lastChangedRanking', lastFetchedRanking);
        listPrev = listLastFetched;
      }
      dispatch({
        type: RANKING_CHANGE_SET,
        listNow,
        listPrev,
        rankingsPointsMap,
      });
      // console.log(listNow, listLastFetched, listLastChanged);
    } catch (error) {
      console.warn('Cannot get ranking from local storage', error);
    }
  };
};
