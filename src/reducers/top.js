import _ from 'lodash/fp';

import { fetchJson } from 'utils/fetch';

import { HOST } from 'constants/backend';

const LOADING = `TOP/LOADING`;
const SUCCESS = `TOP/SUCCESS`;
const ERROR = `TOP/ERROR`;

const initialState = {
  isLoading: false,
  data: [],
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
      const acc =
        Math.floor(
          ((perfects * 100 + res.greats * 60 + res.goods * 30 + res.misses * -20) /
            (perfects + res.greats + res.goods + res.bads + res.misses)) *
            100
        ) / 100;
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
        accuracy: !res.max_combo ? null : acc > 0 ? acc : 0,
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
  // data => {
  //   const playerScores = {};
  //   const playerScoresCount = {};
  //   data.forEach(song => {
  //     const usedResults = [];
  //     _.orderBy(['score'], ['desc'], song.results).forEach(score => {
  //       if (!score.nickname.includes('???') && !_.some({ nickname: score.nickname }, usedResults)) {
  //         usedResults.push(score);
  //       }
  //     });
  //
  //     usedResults.forEach((score, scoreIndex) => {
  //       const enemyScores = usedResults.length > 1 ? usedResults.slice(scoreIndex + 1) : [];
  //       enemyScores.forEach(enemyScore => {
  //         // This is one match between two players
  //         if (!playerScores[score.nickname]) {
  //           playerScoresCount[score.nickname] = 1;
  //         } else playerScoresCount[score.nickname] += 1;
  //         if (!playerScores[enemyScore.nickname]) {
  //           playerScoresCount[enemyScore.nickname] = 1;
  //         } else playerScoresCount[enemyScore.nickname] += 1;
  //         const r1 = playerScores[score.nickname]
  //           ? playerScores[score.nickname]
  //           : (playerScores[score.nickname] = 1000);
  //         const r2 = playerScores[enemyScore.nickname]
  //           ? playerScores[enemyScore.nickname]
  //           : (playerScores[enemyScore.nickname] = 1000);
  //         const R1 = 10 ** (r1 / 300);
  //         const R2 = 10 ** (r2 / 300);
  //         const E1 = R1 / (R1 + R2);
  //         const E2 = R2 / (R1 + R2);
  //         const A = score.score;
  //         const B = enemyScore.score;
  //         let S1 = (A / (A + B) - 0.5) * 10 + 0.5;
  //         let S2 = (B / (A + B) - 0.5) * 10 + 0.5;
  //         S1 = Math.max(0, Math.min(1, S1));
  //         S2 = Math.max(0, Math.min(1, S2));
  //         const K = song.chartLevel ** 2 / 2;
  //         playerScores[score.nickname] = r1 + K * (S1 - E1);
  //         playerScores[enemyScore.nickname] = r2 + K * (S2 - E2);
  //       });
  //     });
  //   });
  //   const arr = Object.keys(playerScores).map(key => ({
  //     name: key,
  //     score: Math.round(playerScores[key]),
  //     count: playerScoresCount[key],
  //   }));
  //   console.log(_.orderBy(['score'], ['desc'], _.remove(i => i.count < 15, arr)));
  //   return data;
  // },
  data => ({ data })
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
      return data;
    } catch (error) {
      dispatch({ type: ERROR, error });
    }
  };
};
