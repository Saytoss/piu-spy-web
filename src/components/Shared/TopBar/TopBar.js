import React, { Component } from 'react';
// import toBe from 'prop-types';
// import classNames from 'classnames';
import { NavLink } from 'react-router-dom';

import './top-bar.scss';

import { routes } from 'constants/routes';

class TopBar extends Component {
  static propTypes = {};

  render() {
    return (
      <header className="top-bar">
        <nav>
          <ul>
            <li>
              <NavLink exact to={routes.leaderboard.path}>
                leaderboard
              </NavLink>
            </li>
            <li>
              <NavLink exact to={routes.ranking.path}>
                ranking
              </NavLink>
            </li>
          </ul>
        </nav>
      </header>
    );
  }
}

export default TopBar;
