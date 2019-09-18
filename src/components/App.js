import React, { Component } from 'react';
import { Route, Redirect } from 'react-router-dom';

import './App.scss';

import { routes } from 'constants/routes';

import Leaderboard from 'components/Leaderboard/Leaderboard';
import Ranking from 'components/Ranking/Ranking';
import Profile from 'components/Profile/Profile';
import TopBar from 'components/Shared/TopBar/TopBar';

class App extends Component {
  render() {
    return (
      <div className="container">
        <TopBar />
        <Route exact path="/" render={() => <Redirect to={routes.leaderboard.path} />} />
        <Route path={routes.leaderboard.path} component={Leaderboard} />
        <Route path={routes.ranking.path} component={Ranking} />
        <Route path={routes.profile.path} component={Profile} />
      </div>
    );
  }
}

export default App;
