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
    results: _.map(
      res => ({
        nickname: res.nickname,
        date: res.gained,
        isExactDate: !!res.exact_gained_date,
        score: res.score,
        perfect: res.perfects,
        great: res.greats,
        good: res.goods,
        bad: res.bads,
        miss: res.misses,
        combo: res.max_combo,
        mods: res.mods_list,
        isRank: !!res.rank_mode,
        accuracy: res.max_combo
          ? (
              (res.perfects * 300 + res.greats * 150 + res.goods * 50 + res.bads * 15) /
              (res.perfects + res.greats + res.goods + res.bads + res.misses) /
              3
            ).toFixed(1)
          : null,
      }),
      item.results
    ),
  })),
  _.orderBy(['song', 'chartLevel'], ['asc', 'desc']),
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
