import React from 'react';
// import toBe from 'prop-types';
// import classNames from 'classnames';
import { NavLink } from 'react-router-dom';
import GoogleLogin from 'react-google-login';
import { FaGoogle } from 'react-icons/fa';

import './top-bar.scss';

import { routes } from 'constants/routes';

function TopBar() {
  const onGoogleResponse = res => {
    console.log(res);
  };
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
      <div className="_flex-fill" />
      <div className="login-container">
        <GoogleLogin
          clientId="197132042723-cmibep21qf6dald9l2l01rif7l5dtd4s.apps.googleusercontent.com"
          buttonText="Login"
          onSuccess={onGoogleResponse}
          onFailure={onGoogleResponse}
          cookiePolicy={'single_host_origin'}
          render={({ onClick, disabled }) => (
            <button className="btn btn-dark btn-icon btn-sm" onClick={onClick} disabled={disabled}>
              <FaGoogle />
              <span> login</span>
            </button>
          )}
        />
      </div>
    </header>
  );
}
export default TopBar;
