import { combineReducers, createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';

import top from 'reducers/top';
import ranking from 'reducers/ranking';
import profiles from 'reducers/profiles';
import presets from 'reducers/presets';

const rootReducer = combineReducers({
  presets,
  profiles,
  ranking,
  top,
});

export const store = createStore(
  rootReducer,
  window.__REDUX_DEVTOOLS_EXTENSION__
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
