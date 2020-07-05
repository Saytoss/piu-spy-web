import { combineReducers, createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import _ from 'lodash/fp';

import tracklist from 'reducers/tracklist';
import trackStats from 'reducers/trackStats';
import popups from 'reducers/popups';
import profiles from 'reducers/profiles';
import preferences from 'reducers/preferences';
import presets from 'reducers/presets';
import results from 'reducers/results';
import user from 'reducers/user';
import login from 'reducers/login';
import topPerSong from 'reducers/topPerSong';

const rootReducer = combineReducers({
  topPerSong,
  login,
  popups,
  preferences,
  presets,
  profiles,
  results,
  trackStats,
  tracklist,
  user,
});

export const store = createStore(
  rootReducer,
  window.__REDUX_DEVTOOLS_EXTENSION__ && process.env.NODE_ENV === 'development'
    ? compose(
        applyMiddleware(thunk),
        window.__REDUX_DEVTOOLS_EXTENSION__({
          stateSanitizer: (state) => ({
            ...state,
            results: {
              ...state.results,
              data: `big array, ${_.size(state.results.data)}`,
              results: `big array, ${_.size(state.results.results)}`,
              sharedCharts: 'big object',
              profiles: _.mapValues(
                (pl) => ({
                  ...pl,
                  resultsByGrade: '...',
                  resultsByLevel: '...',
                  rankingHistory: '...',
                  ratingHistory: '...',
                }),
                state.results.profiles
              ),
            },
          }),
        })
      )
    : applyMiddleware(thunk)
);
