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
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { createSelector } from 'reselect';
import _ from 'lodash/fp';

// styles
import 'react-responsive-ui/style.css';
import './profile.scss';

// constants

// components
import Range from 'components/Shared/Range';

// reducers
import { fetchTopScores } from 'reducers/top';
import { setProfilesFilter, resetProfilesFilter } from 'reducers/profiles';

// utils

// code
const defaultGradesDistribution = {
  SSS: 0,
  SS: 0,
  S: 0,
  'A+': 0,
  A: 0,
  B: 0,
  C: 0,
  D: 0,
  F: 0,
};
const profileSelector = createSelector(
  (state, props) => _.toInteger(props.match.params.id),
  state => state.profiles.data,
  state => state.profiles.filter,
  state => state.top.players,
  state => state.ranking.data,
  (id, data, filter, players, ranking) => {
    const profile = data[id];
    if (_.isEmpty(profile)) {
      return null;
    }
    const levelsDistribution = _.flow(
      _.get('resultsByLevel'),
      _.toPairs,
      _.map(([x, y]) => ({
        x: _.toInteger(x),
        S: _.size(_.filter(res => res.chart.chartType === 'S', y)),
        D: -_.size(_.filter(res => res.chart.chartType === 'D', y)),
      }))
    )(profile);
    const gradesDistribution = _.flow(
      _.get('resultsByLevel'),
      _.toPairs,
      _.map(
        _.update('[1].result.grade', grade =>
          grade && grade.includes('+') && grade !== 'A+' ? grade.replace('+', '') : grade
        )
      ),
      _.map(([x, y]) => ({
        x: _.toInteger(x),
        ...defaultGradesDistribution,
        ..._.omit('?', _.mapValues(_.size, _.groupBy('result.grade', y))),
      })),
      _.map(item => {
        const grades = _.pick(Object.keys(defaultGradesDistribution), item);
        const sum = _.sum(_.values(grades));
        return {
          ...item,
          gradesValues: grades,
          ...(sum === 0 ? grades : _.mapValues(value => (100 * value) / sum, grades)),
        };
      })
    )(profile);

    const lastTick = _.last(profile.rankingHistory).date;
    const firstTick = _.first(profile.rankingHistory).date;
    const minMaxRange = [firstTick / 1000 / 60 / 60 / 24, lastTick / 1000 / 60 / 60 / 24];
    let placesChanges = [];
    let ratingChanges = [];
    if (filter.dayRange) {
      const dayRangeMs = [
        filter.dayRange[0] * 1000 * 60 * 60 * 24,
        filter.dayRange[1] * 1000 * 60 * 60 * 24,
      ];
      placesChanges = profile.rankingHistory.filter(
        item => item.date >= dayRangeMs[0] && item.date <= dayRangeMs[1]
      );
      ratingChanges = profile.ratingHistory.filter(
        item => item.date >= dayRangeMs[0] && item.date <= dayRangeMs[1]
      );
      if (filter.dayRange[0] > minMaxRange[0]) {
        placesChanges.unshift({ ..._.first(placesChanges), date: dayRangeMs[0] });
        ratingChanges.unshift({ ..._.first(ratingChanges), date: dayRangeMs[0] });
      }
      if (filter.dayRange[1] < minMaxRange[1]) {
        placesChanges.push({ ..._.last(placesChanges), date: dayRangeMs[1] });
        ratingChanges.push({ ..._.last(ratingChanges), date: dayRangeMs[1] });
      }
    } else {
      placesChanges = profile.rankingHistory;
      ratingChanges = profile.ratingHistory.filter(
        item => item.date >= firstTick && item.date <= lastTick
      );
    }
    const rankingIndex = _.findIndex({ id }, ranking);
    return {
      ...profile,
      minMaxRange,
      levelsDistribution,
      gradesDistribution,
      placesChanges,
      ratingChanges,
      player: {
        ..._.find({ id }, players),
        rank: rankingIndex + 1,
        ranking: ranking[rankingIndex],
      },
    };
  }
);

const mapStateToProps = (state, props) => {
  return {
    profile: profileSelector(state, props),
    filter: state.profiles.filter,
    error: state.top.error,
    isLoading: state.top.isLoading,
  };
};

const mapDispatchToProps = {
  fetchTopScores,
  setProfilesFilter,
  resetProfilesFilter,
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

  componentWillUnmount() {
    this.props.resetProfilesFilter();
  }

  onRefresh = () => {
    const { isLoading } = this.props;
    !isLoading && this.props.fetchTopScores();
  };

  onChangeDayRange = range => {
    const { filter } = this.props;
    this.props.setProfilesFilter({
      ...filter,
      dayRange: range,
    });
  };

  render() {
    const { isLoading, profile, error, filter } = this.props;
    // console.log(profile);
    if (_.isEmpty(profile)) {
      return null;
    }

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
              <div className="profile-name text-with-header">
                <div className="text-header">игрок</div>
                <div>{profile.player.nickname}</div>
              </div>
              <div className="text-with-header">
                <div className="text-header">ранк</div>
                <div>#{profile.player.rank}</div>
              </div>
              <div className="text-with-header">
                <div className="text-header">эло</div>
                <div>{profile.player.ranking.rating}</div>
              </div>
            </div>
            <div className="levels-chart">
              <ResponsiveContainer>
                <BarChart
                  height={300}
                  width={900}
                  data={profile.levelsDistribution}
                  stackOffset="sign"
                  margin={{ top: 5, bottom: 5, right: 15, left: 5 }}
                >
                  <Tooltip
                    isAnimationActive={false}
                    content={({ active, payload, label }) => {
                      if (!payload || !payload[0]) {
                        return null;
                      }
                      return (
                        <div className="history-tooltip">
                          <div>Level: {payload[0].payload.x}</div>
                          <div style={{ fontWeight: 'bold', color: payload[1].color }}>
                            Single: {Math.abs(payload[1].value)}
                          </div>
                          <div style={{ fontWeight: 'bold', color: payload[0].color }}>
                            Double: {Math.abs(payload[0].value)}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <XAxis dataKey="x" />
                  <YAxis />
                  <Tooltip />
                  <ReferenceLine y={0} stroke="#555" />
                  <Legend />
                  <Bar dataKey="D" fill="#169c16" stackId="stack" />
                  <Bar dataKey="S" fill="#af2928" stackId="stack" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="levels-chart">
              <ResponsiveContainer>
                <BarChart
                  height={300}
                  width={900}
                  data={profile.gradesDistribution}
                  margin={{ top: 5, bottom: 5, right: 15, left: 65 }}
                >
                  <Tooltip
                    isAnimationActive={false}
                    content={({ active, payload, label }) => {
                      if (!payload || !payload[0]) {
                        return null;
                      }
                      return (
                        <div className="history-tooltip">
                          <div>Level: {payload[0].payload.x}</div>
                          {_.reverse(_.filter(item => item.value > 0, payload)).map(item => (
                            <div key={item.name} style={{ fontWeight: 'bold', color: item.color }}>
                              {item.name}: {payload[0].payload.gradesValues[item.name]}
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <XAxis dataKey="x" />
                  <YAxis domain={[0, 100]} hide />
                  <Legend />
                  <Bar dataKey="F" fill="#774949" stackId="stack" />
                  <Bar dataKey="D" fill="#5d4e6d" stackId="stack" />
                  <Bar dataKey="C" fill="#6d5684" stackId="stack" />
                  <Bar dataKey="B" fill="#7a6490" stackId="stack" />
                  <Bar dataKey="A" fill="#828fb7" stackId="stack" />
                  <Bar dataKey="A+" fill="#396eef" stackId="stack" />
                  <Bar dataKey="S" fill="#b19500" stackId="stack" />
                  <Bar dataKey="SS" fill="#dab800" stackId="stack" />
                  <Bar dataKey="SSS" fill="#ffd700" stackId="stack" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="history-chart">
              <ResponsiveContainer>
                <LineChart
                  height={300}
                  width={800}
                  data={profile.placesChanges}
                  margin={{ top: 5, bottom: 5, right: 15, left: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={value => new Date(value).toLocaleDateString()}
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
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="history-chart">
              <ResponsiveContainer>
                <LineChart
                  height={300}
                  width={800}
                  data={profile.ratingChanges}
                  margin={{ top: 5, bottom: 5, right: 15, left: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={value => new Date(value).toLocaleDateString()}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={['dataMin - 100', 'dataMax + 100']}
                    tickFormatter={Math.round}
                  />
                  <ReferenceLine y={1000} stroke="white" />
                  <Tooltip
                    isAnimationActive={false}
                    content={({ active, payload, label }) => {
                      if (!payload || !payload[0]) {
                        return null;
                      }
                      return (
                        <div className="history-tooltip">
                          <div>{new Date(payload[0].payload.date).toLocaleDateString()}</div>
                          {payload && payload[0] && (
                            <div>Rating: {Math.round(payload[0].value)}</div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    isAnimationActive={false}
                    dataKey="rating"
                    stroke="#8884d8"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Range
              range={filter.dayRange || profile.minMaxRange}
              min={profile.minMaxRange[0]}
              max={profile.minMaxRange[1]}
              onChange={this.onChangeDayRange}
            />
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
