import _ from 'lodash/fp';
import localForage from 'localforage';

import { fetchJson } from 'utils/fetch';

import { HOST } from 'constants/backend';

const LOADING = `TOP/LOADING`;
const SUCCESS = `TOP/SUCCESS`;
const ERROR = `TOP/ERROR`;
const SET_FILTER = `TOP/SET_FILTER`;
const RESET_FILTER = `TOP/RESET_FILTER`;
const RANKING_CHANGE_SET = `TOP/RANKING_CHANGE_SET`;

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

const defaultFilter = { showRank: true };

const initialState = {
  isLoading: false,
  data: [],
  filter: defaultFilter,
};

const transformBackendData = _.flow(
  _.get('top'),
  _.values,
  _.map(item => ({
    song: item.track,
    chartLabel: item.chart_label,
    chartLevel: item.chart_label.slice(1),
    chartType: item.chart_label.slice(0, 1),
    mix: item.mix,
    results: item.results.map((res, index) => {
      const perfects = (Math.sqrt(res.perfects) * _.toInteger(item.chart_label.slice(1))) / 2;
      const acc = perfects
        ? Math.floor(
            ((perfects * 100 + res.greats * 60 + res.goods * 30 + res.misses * -20) /
              (perfects + res.greats + res.goods + res.bads + res.misses)) *
              100
          ) / 100
        : null;
      return {
        nickname: res.nickname,
        date: res.gained,
        dateObject: new Date(res.gained),
        grade: res.grade,
        isExactDate: !!res.exact_gain_date,
        score: res.score,
        perfect: res.perfects,
        great: res.greats,
        good: res.goods,
        bad: res.bads,
        miss: res.misses,
        combo: res.max_combo,
        mods: res.mods_list,
        isRank: !!res.rank_mode,
        accuracy: acc < 0 ? 0 : acc,
      };
    }),
  })),
  _.map(song => {
    return {
      ...song,
      latestScoreDate: song.results.reduce(
        (latest, current) => (current.date > latest ? current.date : latest),
        song.results[0].date
      ),
      results: song.results.map(res => ({
        ...res,
        hasRankScore: _.some({ nickname: res.nickname, isRank: true }, song.results),
      })),
    };
  }),
  _.orderBy(['latestScoreDate', 'song', 'chartLevel'], ['desc', 'asc', 'desc']),
  data => {
    const defaultInfo = {
      count: 0,
      battleCount: 0,
      countAcc: 0,
      rating: 1000,
      grades: { F: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 0 },
      totalScore: { S: 0, D: 0 },
      sumAccuracy: 0,
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
        // let S1old = (A / (A + B) - 0.5) * 10 + 0.5;
        // let S2old = (B / (A + B) - 0.5) * 10 + 0.5;
        let S1, S2;
        if (A === B) {
          S1 = S2 = 0.5;
        } else if (maxScore && A !== 0 && B !== 0) {
          A = maxScore / A - 1;
          B = maxScore / B - 1;
          S1 = (B / (A + B) - 0.5) * 3 + 0.5;
          S2 = (A / (A + B) - 0.5) * 3 + 0.5;
        } else {
          // console.log('////////// NO MAX SCORE /////////////');
          S1 = A > B ? 1 : B < A ? 0 : 0.5;
          S2 = 1 - S1;
        }
        // S1 = A > B ? 1 : B < A ? 0 : 0.5;
        // S2 = 1 - S1;
        S1 = Math.max(0, Math.min(1, S1)); // Set strict boundaries to [0, 1]
        S2 = Math.max(0, Math.min(1, S2));
        // S1old = Math.max(0, Math.min(1, S1old)); // Set strict boundaries to [0, 1]
        // S2old = Math.max(0, Math.min(1, S2old));
        // K is the coeficient that decides how strongly this match affects rating
        // Higher level -- affects more
        // More playcount -- affects less (just to make first matches place people faster)
        // const k1pow = Math.min(1, playerInfo[score.nickname].battleCount / 100) * 0.3; // battlecount 0 -> 150 => results in 0 -> 0.5 value here
        // const k2pow = Math.min(1, playerInfo[enemyScore.nickname].battleCount / 100) * 0.3; // battlecount 0 -> 150 => results in 0 -> 0.5 value here

        const kRatingDiff = Math.abs(E1 - E2) + 0.6;
        const kRating1 = Math.max(0, Math.min(1, (r1 - 500) / 1000));
        const kRating2 = Math.max(0, Math.min(1, (r2 - 500) / 1000));
        const maxK1 = 60 + 80 * kRating1;
        const maxK2 = 60 + 80 * kRating2;
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
        // if (song.song === 'BBoom BBoom')
        // if (score.nickname === 'Beamer' || enemyScore.nickname === 'Beamer')
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

        // Change rating as a result of this battle
        playerInfo[score.nickname].rating = r1 + dr1;
        playerInfo[enemyScore.nickname].rating = r2 + dr2;
        // Rating floor
        playerInfo[score.nickname].rating = Math.max(100, playerInfo[score.nickname].rating);
        playerInfo[enemyScore.nickname].rating = Math.max(
          100,
          playerInfo[enemyScore.nickname].rating
        );
      }),
    ])(battles);
    //
    const arr = Object.keys(playerInfo).map(key => ({
      ..._.omit(['countAcc', 'sumAccuracy'], playerInfo[key]),
      name: key,
      accuracy:
        playerInfo[key].countAcc > 0
          ? Math.round((playerInfo[key].sumAccuracy / playerInfo[key].countAcc) * 100) / 100
          : null,
      rating: Math.round(playerInfo[key].rating),
    }));
    const ranking = _.orderBy(['rating'], ['desc'], _.remove(i => i.battleCount < 20, arr));
    // console.log(ranking);

    localForage.setItem('lastFetchedRanking', ranking);
    return { data, ranking };
  }
);

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case LOADING:
      return {
        ...state,
        isLoading: true,
      };
    case ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.error,
      };
    case SUCCESS:
      return {
        ...state,
        isLoading: false,
        ...transformBackendData(action.data),
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
    case RANKING_CHANGE_SET:
      if (_.isEmpty(action.listPrev)) {
        return state; // First time opening this thing and we didn't have any previous data
      }
      return {
        ...state,
        ranking: _.map(player => {
          if (!action.listPrev.includes(player.name)) {
            return { ...player, change: 'NEW' };
          } else if (!action.listNow.includes(player.name)) {
            // Should NEVER happen, idk if this is possible
            return { ...player, change: '?' };
          } else {
            return {
              ...player,
              change: action.listPrev.indexOf(player.name) - action.listNow.indexOf(player.name),
            };
          }
        }, state.ranking),
      };
    default:
      return state;
  }
}

export const fetchTopScores = () => {
  return async dispatch => {
    dispatch({ type: LOADING });
    try {
      const data = await fetchJson({
        url: `${HOST}/top`,
      });
      dispatch({ type: SUCCESS, data });
      dispatch(calculateRankingChanges());
      return data;
    } catch (error) {
      dispatch({ type: ERROR, error });
    }
  };
};

export const setFilter = filter => ({
  type: SET_FILTER,
  filter,
});
export const resetFilter = () => ({
  type: RESET_FILTER,
});

const getListOfNames = _.map('name');
export const calculateRankingChanges = () => {
  return async (dispatch, getState) => {
    const { ranking } = getState().top;

    try {
      const [lastChangedRanking, lastFetchedRanking] = await Promise.all([
        localForage.getItem('lastChangedRanking'),
        localForage.getItem('lastFetchedRanking'),
      ]);
      const listNow = getListOfNames(ranking);
      const listLastFetched = getListOfNames(lastFetchedRanking);
      const listLastChanged = getListOfNames(lastChangedRanking);
      if (!_.isEqual(listNow, listLastFetched)) {
        // Between this fetch and last fetch there was a CHANGE in ranking
        console.log('Ranking has changed, saving last one');
        localForage.setItem('lastChangedRanking', lastFetchedRanking);
        dispatch({ type: RANKING_CHANGE_SET, listNow, listPrev: listLastFetched });
      } else {
        dispatch({ type: RANKING_CHANGE_SET, listNow, listPrev: listLastChanged });
      }
      // console.log(listNow, listLastFetched, listLastChanged);
    } catch (error) {
      console.warn('Cannot get ranking from local storage', error);
    }
  };
};
