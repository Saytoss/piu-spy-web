import React from 'react';
import { connect } from 'react-redux';
import { NavLink } from 'react-router-dom';
import { GoogleLogin, GoogleLogout } from 'react-google-login';
import { FaGoogle } from 'react-icons/fa';

import './top-bar.scss';

// routes
import { routes } from 'constants/routes';

// reducers
import * as loginACs from 'reducers/login';

// redux
const mapStateToProps = state => {
  return {
    isLoadingLogin: state.login.isLoading,
    loginData: state.login.data,
  };
};

const mapDispatchToProps = {
  login: loginACs.login,
  logout: loginACs.logout,
};

function TopBar({ isLoadingLogin, loginData, login, logout }) {
  loginData && console.log('Login data:', loginData);

  const onGoogleResponse = res => {
    if (res.error) {
      console.log('Google login response error:', res);
    } else {
      login(res);
    }
  };

  const onLogout = res => {
    // console.log('Logout response', res);
    logout(res);
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
            <button
              className="btn btn-dark btn-icon btn-sm"
              onClick={onClick}
              disabled={disabled || isLoadingLogin}
            >
              <FaGoogle />
              <span> login</span>
            </button>
          )}
        />
        <button
          className="btn btn-dark btn-icon btn-sm"
          onClick={onLogout}
          disabled={isLoadingLogin}
        >
          <span> logout</span>
        </button>
        {/* <GoogleLogout
          clientId="197132042723-cmibep21qf6dald9l2l01rif7l5dtd4s.apps.googleusercontent.com"
          buttonText="Logout"
          onLogoutSuccess={onLogout}
          onFailure={onLogout}
          render={({ onClick, disabled }) => (
            <button
          className="btn btn-dark btn-icon btn-sm"
          onClick={onClick}
          disabled={disabled || isLoadingLogin}
            >
          <span> logout</span>
            </button>
          )}
        ></GoogleLogout> */}
      </div>
    </header>
  );
}
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TopBar);
