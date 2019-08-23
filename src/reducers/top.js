import { fetchJson } from "utils/fetch";

import { HOST } from "constants/backend";

const LOADING = `TOP/LOADING`;
const SUCCESS = `TOP/SUCCESS`;
const ERROR = `TOP/ERROR`;

const initialState = {
  isLoading: false,
  data: []
};

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case LOADING:
      return {
        ...state,
        isLoading: true
      };
    case ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.error
      };
    case SUCCESS:
      return {
        ...state,
        isLoading: false,
        data: action.data
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
        url: `${HOST}/top`
      });
      dispatch({ type: SUCCESS, data });
      return data;
    } catch (error) {
      dispatch({ type: ERROR, error });
    }
  };
};
