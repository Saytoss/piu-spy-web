import React, { Component } from 'react';
import toBe from 'prop-types';
import { connect } from 'react-redux';
import { FaSearch } from 'react-icons/fa';
import { withRouter } from 'react-router-dom';
import classNames from 'classnames';
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
import { getTimeAgo } from 'utils/leaderboards';

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
const cutRange = (array, range) => {
  const startIndex = _.findIndex(item => item.date > range[0], array);
  const endIndex = _.findLastIndex(item => item.date < range[1], array);
  let firstElement =
    startIndex > 0 ? array[startIndex - 1] : startIndex === 0 ? array[startIndex] : _.last(array);
  let lastElement = endIndex > -1 ? array[endIndex] : _.first(array);
  firstElement = { ...firstElement, date: range[0] };
  lastElement = { ...lastElement, date: range[1] };
  const middleElements =
    startIndex > -1 && endIndex > -1 ? array.slice(startIndex, endIndex + 1) : [];
  return [firstElement, ...middleElements, lastElement];
};
const profileSelector = createSelector(
  (state, props) => _.toInteger(props.match.params.id),
  state => state.profiles.data,
  state => state.profiles.filter,
  state => state.top.players,
  state => state.ranking.data,
  state => state.tracklist.data,
  (id, data, filter, players, ranking, tracklist) => {
    const profile = data[id];
    if (_.isEmpty(profile)) {
      return null;
    }
    const levelsDistribution = _.flow(
      _.get('resultsByLevel'),
      _.toPairs,
      _.map(([x, y]) => ({
        x: _.toInteger(x),
        S:
          (_.size(_.filter(res => res.chart.chartType === 'S', y)) / tracklist.singlesLevels[x]) *
          100,
        D:
          (-_.size(_.filter(res => res.chart.chartType === 'D', y)) / tracklist.doublesLevels[x]) *
          100,
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

    const lastTickRating = _.last(profile.ratingHistory).date;
    const lastTickRanking = _.last(profile.rankingHistory).date;
    const lastTick = lastTickRating > lastTickRanking ? lastTickRating : lastTickRanking; // End graph at either point
    const firstTick = _.first(profile.ratingHistory).date; // Start graph from the first battle of this player

    const minMaxRange = [firstTick / 1000 / 60 / 60 / 24, lastTick / 1000 / 60 / 60 / 24];
    const filterRange = filter.dayRange || minMaxRange;
    const dayRangeMs = [filterRange[0] * 1000 * 60 * 60 * 24, filterRange[1] * 1000 * 60 * 60 * 24];
    const placesChanges = cutRange(profile.rankingHistory, dayRangeMs);
    const ratingChanges = cutRange(profile.ratingHistory, dayRangeMs);
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
    tracklist: state.tracklist.data,
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

  renderRankingHistory() {
    const { profile } = this.props;
    return (
      <ResponsiveContainer aspect={2}>
        <LineChart
          height={300}
          width={800}
          data={profile.ratingChanges}
          margin={{ top: 5, bottom: 5, right: 5, left: 0 }}
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
            width={40}
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
                  {payload && payload[0] && <div>Rating: {Math.round(payload[0].value)}</div>}
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
    );
  }

  renderPlaceHistory() {
    const { profile } = this.props;
    return (
      <ResponsiveContainer aspect={2}>
        <LineChart
          height={300}
          width={800}
          data={profile.placesChanges}
          margin={{ top: 5, bottom: 5, right: 5, left: 0 }}
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
            width={40}
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
    );
  }

  renderLevelsGrades() {
    const { profile } = this.props;
    return (
      <ResponsiveContainer aspect={2}>
        <BarChart
          height={300}
          width={900}
          data={profile.gradesDistribution}
          margin={{ top: 5, bottom: 5, right: 5, left: 0 }}
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
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tickFormatter={x => `${Math.round(x)}%`}
            width={40}
          />
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
    );
  }

  renderLevels() {
    const { profile, tracklist } = this.props;
    return (
      <ResponsiveContainer aspect={2}>
        <BarChart
          height={300}
          width={900}
          data={profile.levelsDistribution}
          stackOffset="sign"
          margin={{ top: 5, bottom: 5, right: 5, left: 0 }}
        >
          <Tooltip
            isAnimationActive={false}
            content={({ active, payload, label }) => {
              if (!payload || !payload[0]) {
                return null;
              }
              const totalD = tracklist.doublesLevels[payload[0].payload.x];
              const totalS = tracklist.singlesLevels[payload[0].payload.x];
              return (
                <div className="history-tooltip">
                  <div>Level: {payload[0].payload.x}</div>
                  {totalS > 0 && (
                    <div style={{ fontWeight: 'bold', color: payload[1].color }}>
                      Single: {Math.abs(payload[1].value).toFixed(1)}% (
                      {Math.round((payload[1].value * totalS) / 100)}/{totalS})
                    </div>
                  )}
                  {totalD > 0 && (
                    <div style={{ fontWeight: 'bold', color: payload[0].color }}>
                      Double: {Math.abs(payload[0].value).toFixed(1)}% (
                      {Math.round((Math.abs(payload[0].value) * totalD) / 100)}/{totalD})
                    </div>
                  )}
                </div>
              );
            }}
          />
          <XAxis dataKey="x" />
          <YAxis tickFormatter={x => Math.abs(x) + '%'} width={40} />
          <Tooltip />
          <ReferenceLine y={0} stroke="#555" />
          <Legend />
          <Bar dataKey="D" fill="#169c16" stackId="stack" />
          <Bar dataKey="S" fill="#af2928" stackId="stack" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  renderGradeBlock(type, grade) {
    const { profile } = this.props;
    const obj = profile.progress[type];
    const typeLetter = type === 'double' ? 'D' : 'S';
    const progr = Math.floor((obj[`${grade}-bonus-level-coef`] || 0) * 100);
    const levelString = obj[`${grade}-bonus-level`]
      ? `${typeLetter}${obj[`${grade}-bonus-level`]}`
      : '?';
    return (
      <div className="grade-block">
        <div className="grade-letter">
          <img src={`${process.env.PUBLIC_URL}/grades/${grade}.png`} alt={grade} />
        </div>
        <div className="grade-level">{levelString}</div>
        <div className="grade-progress">{progr}%</div>
        <div className="grade-progress">бонус: +{Math.floor(obj[`${grade}-bonus`])}</div>
        <div
          className={classNames('progress-background', {
            complete: progr === 100,
            zero: progr === 0,
          })}
          style={{
            height: `${progr}%`,
          }}
        />
      </div>
    );
  }

  render() {
    const { isLoading, profile, error, filter } = this.props;

    if (_.isEmpty(profile)) {
      return null;
    }

    return (
      <div className="profile-page">
        <div className="content">
          {error && error.message}
          <div className="top-controls">
            <div className="_flex-fill" />
            {/* <div className="beta">страница в бета-версии</div> */}
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
              <div className="text-with-header">
                <div className="text-header">последняя игра</div>
                <div>{profile.lastResultDate ? getTimeAgo(profile.lastResultDate) : 'никогда'}</div>
              </div>
            </div>
            <div className="profile-section">
              <div className="profile-section-content">
                <div className="profile-section-2">
                  <div className="profile-sm-section-header">
                    <span>уровни</span>
                  </div>
                  <div>{this.renderLevels()}</div>
                </div>
                <div className="profile-section-2">
                  <div className="profile-sm-section-header">
                    <span>оценки</span>
                  </div>
                  <div>{this.renderLevelsGrades()}</div>
                </div>
              </div>
            </div>
            <div className="profile-section">
              <div className="profile-section-content">
                <div className="profile-section-2">
                  <div className="profile-sm-section-header">
                    <span>эло</span>
                  </div>
                  <div>{this.renderRankingHistory()}</div>
                </div>
                <div className="profile-section-2">
                  <div className="profile-sm-section-header">
                    <span>место в топе</span>
                  </div>
                  <div>{this.renderPlaceHistory()}</div>
                </div>
              </div>
              <div className="range-container">
                <Range
                  range={filter.dayRange || profile.minMaxRange}
                  min={profile.minMaxRange[0]}
                  max={profile.minMaxRange[1]}
                  onChange={this.onChangeDayRange}
                />
              </div>
            </div>
            <div className="profile-section progress-section">
              <div className="profile-sm-section-header">
                <span>ачивки по уровням</span>
              </div>
              <div className="progress-blocks-single-double">
                <div className="progress-block">
                  <div className="achievements-grades single">
                    {this.renderGradeBlock('single', 'A')}
                    {this.renderGradeBlock('single', 'A+')}
                    {this.renderGradeBlock('single', 'S')}
                    {this.renderGradeBlock('single', 'SS')}
                  </div>
                </div>
                <div className="progress-block">
                  <div className="achievements-grades double">
                    {this.renderGradeBlock('double', 'A')}
                    {this.renderGradeBlock('double', 'A+')}
                    {this.renderGradeBlock('double', 'S')}
                    {this.renderGradeBlock('double', 'SS')}
                  </div>
                </div>
              </div>
              <div className="bonus-faq">
                * суммарный бонус (+{Math.round(profile.progress.bonus)}) добавляется к стартовому
                Эло
                <br />* для получения ачивки нужно сыграть около 10% всех чартов данного левела на
                нужный грейд
              </div>
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
