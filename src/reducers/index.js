import { combineReducers, createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';

import tracklist from 'reducers/tracklist';
import ranking from 'reducers/ranking';
import profiles from 'reducers/profiles';
import presets from 'reducers/presets';
import results from 'reducers/results';
import login from 'reducers/login';

const rootReducer = combineReducers({
  login,
  presets,
  profiles,
  ranking,
  tracklist,
  results,
});

export const store = createStore(
  rootReducer,
  window.__REDUX_DEVTOOLS_EXTENSION__ && process.env.NODE_ENV === 'development'
    ? compose(
        applyMiddleware(thunk),
        window.__REDUX_DEVTOOLS_EXTENSION__({
          stateSanitizer: state => ({
            ...state,
          }),
        })
      )
    : applyMiddleware(thunk)
);
