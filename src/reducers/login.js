import { postJson } from 'utils/fetch';

import { HOST } from 'constants/backend';

const LOADING = `LOGIN/LOADING`;
const SUCCESS = `LOGIN/SUCCESS`;
const ERROR = `LOGIN/ERROR`;

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
    default:
      return state;
  }
}

export const login = googleResponse => {
  return async dispatch => {
    dispatch({ type: LOADING });
    try {
      console.log('google response:', googleResponse);
      const data = await postJson({
        url: `${HOST}/login/google`,
        body: { token: googleResponse.tokenId },
      });
      console.log('/login response:', data);
      dispatch({ type: SUCCESS, data });
      return data;
    } catch (error) {
      dispatch({ type: ERROR, error });
      return null;
    }
  };
};

export const logout = () => {
  return async dispatch => {
    dispatch({ type: LOADING });
    try {
      const data = await postJson({
        url: `${HOST}/logout`,
      });
      console.log('/logout response:', data);
      dispatch({ type: SUCCESS, data });
      return data;
    } catch (error) {
      dispatch({ type: ERROR, error });
      return null;
    }
  };
};
