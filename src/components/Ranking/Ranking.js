import React, { Component } from 'react';
import toBe from 'prop-types';
import { connect } from 'react-redux';
import { FaSearch, FaQuestionCircle } from 'react-icons/fa';
import { Link, Route, withRouter } from 'react-router-dom';

// styles
import 'react-responsive-ui/style.css';
import './ranking.scss';

// components
import RankingList from './RankingList';
import RankingFaq from './RankingFaq';

// constants
import { routes } from 'constants/routes';

// reducers
import { fetchTopScores, calculateRankingChanges } from 'reducers/top';

// utils

// code

const mapStateToProps = state => {
  return {
    ranking: state.top.ranking,
    error: state.top.error,
    isLoading: state.top.isLoading,
  };
};

const mapDispatchToProps = {
  fetchTopScores,
  calculateRankingChanges,
};

class Ranking extends Component {
  static propTypes = {
    ranking: toBe.array,
    error: toBe.object,
    isLoading: toBe.bool.isRequired,
  };

  static defaultProps = {
    ranking: [],
  };

  async componentDidMount() {
    const { isLoading } = this.props;
    if (!isLoading) {
      await this.props.fetchTopScores();
      this.props.calculateRankingChanges();
    }
  }

  onRefresh = async () => {
    const { isLoading } = this.props;
    if (!isLoading) {
      await this.props.fetchTopScores();
      this.props.calculateRankingChanges();
    }
  };

  render() {
    const { isLoading, ranking, error } = this.props;

    return (
      <div className="ranking-page">
        <div className="content">
          {error && error.message}
          <div className="top-controls">
            <div className="_flex-fill" />
            <Route
              exact
              path={routes.ranking.path}
              render={() => (
                <>
                  <button
                    disabled={isLoading}
                    className="btn btn-sm btn-dark btn-icon _margin-right"
                    onClick={this.onRefresh}
                  >
                    <FaSearch /> обновить
                  </button>
                  <Link to={routes.ranking.faq.path}>
                    <button className="btn btn-sm btn-dark btn-icon">
                      <FaQuestionCircle /> faq
                    </button>
                  </Link>
                </>
              )}
            />
            <Route
              exact
              path={routes.ranking.faq.path}
              render={() => (
                <Link to={routes.ranking.path}>
                  <button className="btn btn-sm btn-dark btn-icon">назад</button>
                </Link>
              )}
            />
          </div>
          <Route
            exact
            path={routes.ranking.path}
            render={() => <RankingList ranking={ranking} isLoading={isLoading} />}
          />
          <Route exact path={routes.ranking.faq.path} component={RankingFaq} />
        </div>
      </div>
    );
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(Ranking));
