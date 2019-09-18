import React, { Component } from 'react';
import toBe from 'prop-types';
import { connect } from 'react-redux';
import { FaSearch } from 'react-icons/fa';
import { withRouter } from 'react-router-dom';
import {
  BarChart,
  Bar,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Line,
  Brush,
} from 'recharts';
import _ from 'lodash/fp';
import moment from 'moment';

// styles
import 'react-responsive-ui/style.css';
import './profile.scss';
// import 'react-vis/dist/style.css';

// constants

// reducers
import { fetchTopScores } from 'reducers/top';

// utils

// code

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

  static defaultProps = {
    profile: {},
  };

  onRefresh = () => {
    const { isLoading } = this.props;
    !isLoading && this.props.fetchTopScores();
  };

  render() {
    const { isLoading, profile, error, match } = this.props;
    if (_.isEmpty(profile)) {
      return null;
    }
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

    let brushData = [];
    let historyTicks = [];
    const lastTick = _.last(profile.rankingHistory).date;
    const firstTick = _.first(profile.rankingHistory).date;
    for (let date = moment(firstTick); date.isBefore(lastTick); date.add(1, 'day')) {
      brushData.push({ date: date.valueOf() });
    }
    for (let date = moment(lastTick); date.isAfter(firstTick); date.subtract(1, 'month')) {
      historyTicks = [date.valueOf(), ...historyTicks];
    }
    const placesData = _.flow(
      items => {
        const newItems = items.map((item, index) => {
          if (index > 0 && items[index - 1].date < item.date - 24 * 60 * 60 * 1000) {
            return [
              ..._.map(
                it => ({ date: it.date, place: items[index - 1].place }),
                _.filter(
                  ({ date: tick }) => tick > items[index - 1].date && tick < item.date,
                  brushData
                )
              ),
              item,
            ];
          }
          return item;
        });
        return _.flatten(newItems);
      },
      _.map(item => ({
        ...item,
        dateRounded: Math.round(item.date / 1000 / 60 / 60 / 24),
      }))
    )(profile.rankingHistory);
    return (
      <div className="profile-page">
        <div className="content">
          {error && error.message}
          <div className="top-controls">
            <div className="_flex-fill" />
            <div className="beta">страница в бета-версии</div>
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
                <ReferenceLine y={0} stroke="#555" />
                <Bar dataKey="D" fill="#169c16" stackId="stack" />
                <Bar dataKey="S" fill="#af2928" stackId="stack" />
              </BarChart>
            </div>
            <div className="history-chart">
              <LineChart
                height={300}
                width={800}
                data={placesData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="dateRounded"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={value =>
                    new Date(value * 24 * 60 * 60 * 1000).toLocaleDateString()
                  }
                />
                <YAxis
                  allowDecimals={false}
                  domain={[1, dataMax => (dataMax < 3 ? dataMax + 2 : dataMax + 1)]}
                  interval={0}
                  reversed
                />
                <Tooltip
                  isAnimationActive={false}
                  content={({ active, payload, label }) => {
                    if (!payload || !payload[0]) {
                      return null;
                    }
                    return (
                      <div className="history-tooltip">
                        <div>{new Date(payload[0].payload.date).toLocaleDateString()}</div>
                        {payload && payload[0] && <div>Place: #{payload[0].value}</div>}
                      </div>
                    );
                  }}
                />
                <Line
                  isAnimationActive={false}
                  type="stepAfter"
                  dataKey="place"
                  stroke="#8884d8"
                  strokeWidth={3}
                  dot={false}
                />
                <Brush
                  data={brushData}
                  dataKey="date"
                  height={40}
                  stroke="#8884d8"
                  travellerWidth={20}
                  tickFormatter={value => new Date(value).toLocaleDateString()}
                />
              </LineChart>
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
