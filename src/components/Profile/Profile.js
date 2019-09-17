import React, { Component } from 'react';
import toBe from 'prop-types';
import { connect } from 'react-redux';
import { FaSearch } from 'react-icons/fa';
import { withRouter } from 'react-router-dom';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import _ from 'lodash/fp';

// styles
import 'react-responsive-ui/style.css';
import './profile.scss';
// import 'react-vis/dist/style.css';

// constants

// reducers
import { fetchTopScores } from 'reducers/top';

// utils

// code
const tickValues = [...Array(28)].map((x, i) => i + 1);

const mapStateToProps = (state, props) => {
  return {
    profile: state.profiles.data[props.match.params.name],
    error: state.top.error,
    isLoading: state.top.isLoading,
  };
};

const mapDispatchToProps = {
  fetchTopScores,
};

class Profile extends Component {
  static propTypes = {
    profile: toBe.object,
    error: toBe.object,
    isLoading: toBe.bool.isRequired,
  };

  onRefresh = () => {
    const { isLoading } = this.props;
    !isLoading && this.props.fetchTopScores();
  };

  render() {
    const { isLoading, profile, error, match } = this.props;
    console.log(match, profile);
    const levelsData = _.flow(
      _.get('resultsByLevel'),
      _.toPairs,
      _.map(([x, y]) => ({
        x: _.toInteger(x),
        S: _.size(_.filter(res => res.chart.chartType === 'S', y)),
        D: -_.size(_.filter(res => res.chart.chartType === 'D', y)),
      }))
    )(profile);
    console.log(levelsData);
    return (
      <div className="profile-page">
        <div className="content">
          {error && error.message}
          <div className="top-controls">
            <div className="_flex-fill" />
            <button
              disabled={isLoading}
              className="btn btn-sm btn-dark btn-icon"
              onClick={this.onRefresh}
            >
              <FaSearch /> обновить
            </button>
          </div>
          <div className="profile">
            <div className="profile-header">
              <div className="profile-name">{match.params.name}</div>
            </div>
            <div className="levels-chart">
              <BarChart
                height={300}
                width={800}
                data={levelsData}
                stackOffset="sign"
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <XAxis dataKey="x" />
                <YAxis />
                <Tooltip />
                <Legend />
                <ReferenceLine y={0} stroke="#555" />
                <Bar dataKey="D" fill="#169c16" stackId="stack" />
                <Bar dataKey="S" fill="#af2928" stackId="stack" />
              </BarChart>
              {/* <FlexibleWidthXYPlot height={200} xType="ordinal" stackBy="y">
                <VerticalBarSeries color="#af2928" data={levelsDataS} />
                <XAxis
                  tickSize={0}
                  tickFormat={value => value.toFixed(0)}
                  tickValues={tickValues}
                />
                <VerticalBarSeries color="#169c16" data={levelsDataD} />
              </FlexibleWidthXYPlot> */}
              {/* <FlexibleWidthXYPlot height={200}> */}
              {/* <VerticalBarSeries color="#169c16" data={levelsDataD} />
                  <XAxis
                    tickSize={0}
                    tickFormat={value => value.toFixed(0)}
                    tickValues={tickValues}
                  /> */}
              {/* <VerticalBarSeries color="#169c16" data={levelsDataD} />
              </FlexibleWidthXYPlot> */}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(Profile));
