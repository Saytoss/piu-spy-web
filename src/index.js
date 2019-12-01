import 'promise-polyfill';
import 'whatwg-fetch';
import 'utils/polyfills';

import React from 'react';
import ReactDOM from 'react-dom';
import { HashRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import localForage from 'localforage';
import _ from 'lodash/fp';

import './index.scss';
import App from 'components/App';

import { CHART_MIN_MAX } from 'constants/leaderboard';

import { store } from 'reducers';
import { fetchResults, setFilter } from 'reducers/results';
import { fetchTracklist } from 'reducers/tracklist';

localForage
  .getItem('filter')
  .then(filter => {
    if (filter) {
      store.dispatch(
        setFilter({
          ...filter,
          chartRange: filter.chartRange && {
            ...filter.chartRange,
            range: _.every(
              r => r >= CHART_MIN_MAX[0] && r <= CHART_MIN_MAX[1],
              filter.chartRange.range
            )
              ? filter.chartRange.range
              : CHART_MIN_MAX,
          },
        })
      );
    }
  })
  .catch(error => console.error('Cannot get filter from local storage', error));

store.dispatch(fetchTracklist()).then(() => {
  store.dispatch(fetchResults());
});

ReactDOM.render(
  <Provider store={store}>
    <HashRouter>
      <App />
    </HashRouter>
  </Provider>,
  document.getElementById('root')
);
