import React, { Component } from 'react';
import { Route } from 'react-router-dom';

import './App.scss';

import Rankings from 'components/Rankings/Rankings';

class App extends Component {
  render() {
    return (
      <div className="container">
        <Route exact path="/" component={Rankings} />
      </div>
    );
  }
}

export default App;
