import { fetchJson } from 'utils/fetch';

import { HOST } from 'constants/backend';

const LOADING = `USER/LOADING`;
const SUCCESS = `USER/SUCCESS`;
const ERROR = `USER/ERROR`;
const RESET = `USER/RESET`;

const initialState = {
  isLoading: false,
  data: null,
};

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case LOADING:
      return {
        ...state,
        isLoading: true,
        data: null,
      };
    case ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.error,
        data: null,
      };
    case SUCCESS:
      return {
        ...state,
        isLoading: false,
        data: action.data,
      };
    case RESET:
      return initialState;
    default:
      return state;
  }
}

export const fetchUser = () => {
  return async dispatch => {
    dispatch({ type: LOADING });
    try {
      const data = await fetchJson({ url: `${HOST}/profile` });
      dispatch({ type: SUCCESS, data });
      return data;
    } catch (error) {
      dispatch({ type: ERROR, error });
      return null;
    }
  };
};

export const resetUser = () => ({ type: RESET });
