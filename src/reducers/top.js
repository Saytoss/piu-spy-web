import _ from 'lodash/fp';

import { fetchJson } from 'utils/fetch';

import { getRankings, setRankings } from './ranking';
import { getProfiles, getInitialProfiles, setProfiles } from './profiles';

import { HOST } from 'constants/backend';

const LOADING = `TOP/LOADING`;
const SUCCESS = `TOP/SUCCESS`;
const ERROR = `TOP/ERROR`;
const SET_FILTER = `TOP/SET_FILTER`;
const RESET_FILTER = `TOP/RESET_FILTER`;

export const defaultFilter = { showRank: true, showRankAndNorank: true };

const initialState = {
  isLoading: false,
  data: [],
  filter: defaultFilter,
};

const preprocessData = data =>
  _.flow(
    _.get('top'),
    _.values,
    _.map(item => {
      let latestScoreDate = item.results[0].gained;
      let fullRes = null;
      let firstResultMap = {};
      _.forEach(r => {
        if (!fullRes && _.every(_.isNumber, [r.perfects, r.greats, r.goods, r.bads, r.misses])) {
          fullRes = r;
        }
        firstResultMap[r.player] = firstResultMap[r.player] || r;
        latestScoreDate = r.gained > latestScoreDate ? r.gained : latestScoreDate;
      }, item.results);

      const stepSum =
        fullRes &&
        fullRes.perfects + fullRes.greats + fullRes.goods + fullRes.bads + fullRes.misses;

      const [chartType, chartLevel] = item.chart_label.match(/(\D+)|(\d+)/g);

      return {
        song: item.track,
        chartLabel: item.chart_label,
        chartLevel,
        chartType,
        mix: item.mix,
        duration: item.duration,
        latestScoreDate,
        results: item.results.map((res, index) => {
          let _r = {
            id: res.id,
            playerId: res.player,
            nickname: data.players[res.player].nickname,
            nicknameArcade: data.players[res.player].arcade_name,
            originalChartMix: res.originalChartMix,
            originalChartLabel: res.originalChartLabel,
            originalScore: res.originalScore,
            date: res.gained,
            dateObject: new Date(res.gained),
            grade: res.grade,
            isExactDate: !!res.exact_gain_date,
            score: res.score,
            scoreIncrease: res.score_increase,
            calories: res.calories && res.calories / 1000,
            perfect: res.perfects,
            great: res.greats,
            good: res.goods,
            bad: res.bads,
            miss: res.misses,
            combo: res.max_combo,
            mods: res.mods_list,
            isRank: !!res.rank_mode,
            isHJ: (res.mods_list || '').split(' ').includes('HJ'),
          };

          if (stepSum) {
            const infos = [_r.perfect, _r.great, _r.good, _r.bad, _r.miss];
            let fixableIndex = -1;
            let localStepSum = 0;
            const canFix =
              infos.filter((numb, index) => {
                if (!_.isNumber(numb)) {
                  fixableIndex = index;
                  return true;
                }
                localStepSum += numb;
                return false;
              }).length === 1;
            if (canFix) {
              _r[['perfect', 'great', 'good', 'bad', 'miss'][fixableIndex]] =
                stepSum - localStepSum;
            }
          }
          const perfects = Math.sqrt(_r.perfect) * 10;
          const acc = perfects
            ? Math.floor(
                ((perfects * 100 + _r.great * 60 + _r.good * 30 + _r.miss * -20) /
                  (perfects + _r.great + _r.good + _r.bad + _r.miss)) *
                  100
              ) / 100
            : null;
          const accRaw = _r.perfect
            ? Math.floor(
                ((_r.perfect * 100 + _r.great * 60 + _r.good * 30 + _r.miss * -20) /
                  (_r.perfect + _r.great + _r.good + _r.bad + _r.miss)) *
                  100
              ) / 100
            : null;
          return {
            ..._r,
            isPlayersTopResult: firstResultMap[res.player] === res,
            accuracy: acc < 0 ? 0 : accRaw === 100 ? 100 : acc && +acc.toFixed(2),
            accuracyRaw: accRaw,
          };
        }),
      };
    }),
    _.orderBy(['latestScoreDate', 'song', 'chartLevel'], ['desc', 'asc', 'desc'])
  )(data);

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
        data: action.data,
        players: action.players,
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

export const fetchTopScores = () => {
  return async (dispatch, getState) => {
    dispatch({ type: LOADING });
    try {
      const data = await fetchJson({
        url: `${HOST}/top/v2`,
      });
      // const data = jsonData;
      const processedData = preprocessData(data);
      const initialProfiles = getInitialProfiles(processedData, getState().tracklist);
      const rankings = getRankings(processedData, data, initialProfiles);
      dispatch({
        type: SUCCESS,
        data: processedData,
        players: _.flow(
          _.toPairs,
          _.map(([id, player]) => ({ ...player, id: _.toInteger(id) }))
        )(data.players),
      });
      dispatch(setRankings(rankings));
      const profiles = getProfiles(initialProfiles, processedData, rankings);
      dispatch(setProfiles(profiles));
      return processedData;
    } catch (error) {
      console.log(error);
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
