import { combineReducers, createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';

import top from 'reducers/top';

const rootReducer = combineReducers({
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
