import React, { useEffect } from 'react';
import { Route, Redirect } from 'react-router-dom';
import { connect } from 'react-redux';
import localForage from 'localforage';
import _ from 'lodash/fp';

import 'react-responsive-ui/style.css';
import './App.scss';

import { routes } from 'constants/routes';
import { CHART_MIN_MAX } from 'constants/leaderboard';

import SongsTop from 'components/SongsTop/SongsTop';
import Leaderboard from 'components/Leaderboard/Leaderboard';
import Ranking from 'components/Ranking/Ranking';
import Profile from 'components/Profile/Profile';
import TopBar from 'components/Shared/TopBar/TopBar';
import Loader from 'components/Shared/Loader';
import LoginScreen from 'components/LoginScreen/LoginScreen';
import SocketTracker from 'components/SocketTracker/SocketTracker';

import { fetchResults, setFilter } from 'reducers/results';
import { fetchTracklist } from 'reducers/tracklist';
import { fetchUser } from 'reducers/user';

const mapStateToProps = state => {
  return {
    data: state.user.data,
    isLoading: state.user.isLoading,
  };
};

const mapDispatchToProps = {
  setFilter,
  fetchResults,
  fetchTracklist,
  fetchUser,
};

function App(props) {
  const { fetchUser, fetchTracklist, fetchResults, setFilter, data, isLoading } = props;

  useEffect(() => {
    localForage
      .getItem('filter')
      .then(filter => {
        if (filter) {
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
          });
        }
      })
      .catch(error => console.error('Cannot get filter from local storage', error));
    fetchUser();
  }, [fetchUser, fetchTracklist, fetchResults, setFilter]);

  useEffect(() => {
    if (data && data.player) {
      fetchTracklist().then(() => {
        fetchResults();
      });
    }
  }, [data, fetchResults, fetchTracklist]);

  if (isLoading) {
    return (
      <div className="container">
        <Loader />
      </div>
    );
  }

  if (!data || !data.player) {
    return <LoginScreen />;
  }

  if (process.env.REACT_APP_SOCKET) {
    return <SocketTracker />;
  }

  return (
    <div className="container">
      <TopBar />
      <Route exact path="/" render={() => <Redirect to={routes.leaderboard.path} />} />
      <Route path={routes.leaderboard.path} component={Leaderboard} />
      <Route path={routes.ranking.path} component={Ranking} />
      <Route path={routes.profile.path} component={Profile} />
      <Route path={routes.songs.path} component={SongsTop} />
    </div>
  );
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);
