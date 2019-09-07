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
    const playerInfo = {};
    data.forEach(song => {
      const usedResults = [];
      _.orderBy(['score'], ['desc'], song.results).forEach(score => {
        if (!score.nickname.includes('???') && !_.some({ nickname: score.nickname }, usedResults)) {
          // score.ratingDiff = 0;
          usedResults.push(score);
        }
      });

      usedResults.forEach((score, scoreIndex) => {
        const enemyScores = usedResults.length > 1 ? usedResults.slice(scoreIndex + 1) : [];
        const defaultInfo = {
          count: 0,
          battleCount: 0,
          countAcc: 0,
          rating: 1000,
          grades: { F: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 0 },
          totalScore: { S: 0, D: 0 },
          sumAccuracy: 0,
        };
        if (!playerInfo[score.nickname]) {
          playerInfo[score.nickname] = _.cloneDeep(defaultInfo);
        }

        playerInfo[score.nickname].count++;
        score.accuracy && playerInfo[score.nickname].countAcc++;
        playerInfo[score.nickname].sumAccuracy += score.accuracy;
        playerInfo[score.nickname].totalScore[song.chartType] += score.score;
        playerInfo[score.nickname].grades[score.grade.replace('+', '')]++;
        score.startingRating = playerInfo[score.nickname].rating;

        enemyScores.forEach(enemyScore => {
          // This is one match between two players
          if (!playerInfo[enemyScore.nickname]) {
            playerInfo[enemyScore.nickname] = _.cloneDeep(defaultInfo);
          }
          playerInfo[score.nickname].battleCount++;
          playerInfo[enemyScore.nickname].battleCount++;

          // Elo formula
          const r1 = playerInfo[score.nickname].rating;
          const r2 = playerInfo[enemyScore.nickname].rating;
          const R1 = 10 ** (r1 / 400);
          const R2 = 10 ** (r2 / 400);
          const E1 = R1 / (R1 + R2);
          const E2 = R2 / (R1 + R2);
          const A = score.score;
          const B = enemyScore.score;
          // S1/S2 is the factor of winning
          // S1 = 1  S2 = 0  -- player 1 wins
          // S1 = 0.5  S2 = 0.5  -- draw
          // I'm using difference in score to get this value, it ranges from 0 from 1
          // Current formula assigns 100% win if you have at least ~15% more score than the other player
          // 3.000 vs 3.500 score -- 0 / 1 win percentage -- clear win for player 2
          // 3.000 vs 3.300 score -- 0.17 / 0.83 win percentage -- ranking is not affected as strongly as 0 / 1
          // 3.000 vs 3.100 score -- 0.38 / 0.62 win percentage -- almost draw
          let S1 = (A / (A + B) - 0.5) * 14 + 0.5;
          let S2 = (B / (A + B) - 0.5) * 14 + 0.5;
          S1 = Math.max(0, Math.min(1, S1)); // Set strict boundaries to [0, 1]
          S2 = Math.max(0, Math.min(1, S2));
          // K is the coeficient that decides how strongly this match affects rating
          // Higher level -- affects more
          // More playcount -- affects less (just to make first matches place people faster)
          const k1pow = Math.min(1, playerInfo[score.nickname].battleCount / 150) * 0.5; // battlecount 0 -> 150 => results in 0 -> 0.5 value here
          const k2pow = Math.min(1, playerInfo[enemyScore.nickname].battleCount / 150) * 0.5; // battlecount 0 -> 150 => results in 0 -> 0.5 value here
          const K1 = Math.min(20, Math.max(4, song.chartLevel - 4)) ** (2.2 - k1pow) / 2;
          const K2 = Math.min(20, Math.max(4, song.chartLevel - 4)) ** (2.2 - k2pow) / 2;
          let dr1 = K1 * (S1 - E1);
          let dr2 = K2 * (S2 - E2);
          // Do not decrease rating if you have SSS - RIP zero-sum algorithm
          dr1 = dr1 < 0 && score.grade === 'SSS' ? 0 : dr1;
          dr2 = dr2 < 0 && enemyScore.grade === 'SSS' ? 0 : dr2;
          // Recording this value for display
          score.ratingDiff = (score.ratingDiff || 0) + dr1;
          enemyScore.ratingDiff = (enemyScore.ratingDiff || 0) + dr2;
          // if (score.nickname === 'grumd' || enemyScore.nickname === 'grumd') {
          // console.log(
          //   `${song.song} ${song.chartLabel} - ${score.nickname} / ${enemyScore.nickname} - ${
          //     score.score
          //   } / ${enemyScore.score} - E ${E1.toFixed(2)} / ${E2.toFixed(2)} - R ${S1.toFixed(
          //     2
          //   )}/${S2.toFixed(2)} - Rating ${r1.toFixed(2)} / ${r2.toFixed(2)} - ${dr1.toFixed(
          //     2
          //   )} / ${dr2.toFixed(2)} - K ${K1.toFixed(2)} ${K2.toFixed(2)}`
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
        });
      });
    });
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
