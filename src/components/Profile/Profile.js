import React, { Component } from 'react';
import toBe from 'prop-types';
import { connect } from 'react-redux';
import { FaSearch, FaQuestionCircle, FaTimes } from 'react-icons/fa';
import { withRouter } from 'react-router-dom';
import classNames from 'classnames';
import ReactModal from 'react-modal';
import Tooltip from 'react-responsive-ui/modules/Tooltip';
import {
  BarChart,
  Bar,
  LineChart,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  CartesianGrid,
  Line,
  Legend,
  ResponsiveContainer,
  Label,
} from 'recharts';
import { createSelector } from 'reselect';
import _ from 'lodash/fp';
import moment from 'moment';

// styles
import './profile.scss';

// constants

// components
import Range from 'components/Shared/Range';
import Loader from 'components/Shared/Loader';
import Toggle from 'components/Shared/Toggle/Toggle';
import MostPlayed from './MostPlayed';
import ExpFaq from './ExpFaq';

// reducers
import { fetchResults } from 'reducers/results';
import { setProfilesFilter, resetProfilesFilter } from 'reducers/profiles';

// utils
import { parseDate } from 'utils/date';
import { getTimeAgo } from 'utils/leaderboards';
import { achievements } from 'utils/achievements';
import { getRankImg } from 'utils/exp';

// code
const MIN_GRAPH_HEIGHT = undefined;
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
const defaultGradesWithLevelsDistribution = _.flow(
  _.flatMap(type => {
    return _.flow(
      _.toPairs,
      _.map(([grade, value]) => [`${type}-${grade}`, value])
    )(defaultGradesDistribution);
  }),
  _.fromPairs
)(['S', 'D']);

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
  state => state.results.profiles,
  state => state.profiles.filter,
  state => state.tracklist.data,
  (id, profiles, filter, tracklist) => {
    const profile = profiles[id];
    if (_.isEmpty(profile)) {
      return null;
    }
    const levelsDistribution = _.flow(
      _.get('resultsByLevel'),
      _.toPairs,
      _.map(([x, y]) => ({
        x: _.toInteger(x),
        S:
          (_.size(_.filter(res => res.chart.chartType === 'S' || res.chart.chartType === 'SP', y)) /
            tracklist.singlesLevels[x]) *
          100,
        D:
          (-_.size(
            _.filter(res => res.chart.chartType === 'D' || res.chart.chartType === 'DP', y)
          ) /
            tracklist.doublesLevels[x]) *
          100,
      }))
    )(profile);
    const gradesData = _.flow(
      _.get('resultsByLevel'),
      _.toPairs,
      _.map(
        _.update('[1].result.grade', grade =>
          grade && grade.includes('+') && grade !== 'A+' ? grade.replace('+', '') : grade
        )
      )
    )(profile);
    const gradesDistribution = _.flow(
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
    )(gradesData);
    const gradesAndLevelsDistribution = _.flow(
      _.map(([x, y]) => {
        const groupedResults = _.groupBy('result.grade', y);
        const counts = _.omit(
          '?',
          _.mapValues(
            _.countBy(res => {
              return res.chart.chartType === 'S' || res.chart.chartType === 'SP'
                ? 'S'
                : res.chart.chartType === 'D' || res.chart.chartType === 'DP'
                ? 'D'
                : 'Other';
            }),
            groupedResults
          )
        );
        const reduced = _.reduce(
          (acc, [grade, levelsData]) => {
            const accData = _.flow(
              _.toPairs,
              _.map(([type, count]) => [
                `${type}-${grade}`,
                type === 'S'
                  ? (count / tracklist.singlesLevels[x]) * 100
                  : (-count / tracklist.doublesLevels[x]) * 100,
              ]),
              _.fromPairs
            )(levelsData);
            return { ...acc, ...accData };
          },
          {},
          _.toPairs(counts)
        );

        return {
          x: _.toInteger(x),
          ...defaultGradesWithLevelsDistribution,
          ...reduced,
        };
      })
    )(gradesData);
    const lastTickRating = _.last(profile.ratingHistory).date;
    const lastTickRanking = _.last(profile.rankingHistory).date;
    const lastTick = lastTickRating > lastTickRanking ? lastTickRating : lastTickRanking; // End graph at either point
    const firstTick = _.first(profile.ratingHistory).date; // Start graph from the first battle of this player
    const lastDay = moment(lastTick).endOf('day');
    const firstDay = moment(firstTick).startOf('day');
    const minMaxRange = [firstDay / 1000 / 60 / 60 / 24, lastDay / 1000 / 60 / 60 / 24];

    const filterRange = filter.dayRange || [
      Math.max(minMaxRange[0], minMaxRange[1] - 30),
      minMaxRange[1],
    ];
    const dayRangeMs = [
      +moment(filterRange[0] * 1000 * 60 * 60 * 24).startOf('day'),
      +moment(filterRange[1] * 1000 * 60 * 60 * 24).endOf('day'),
    ];
    const placesChanges = cutRange(profile.rankingHistory, dayRangeMs);
    const ratingChanges = cutRange(profile.ratingHistory, dayRangeMs);
    const rank = 1 + _.findIndex({ id }, _.orderBy(['ratingRaw'], ['desc'], _.values(profiles)));
    return {
      ...profile,
      rank,
      minMaxRange,
      filterRange,
      levelsDistribution,
      gradesDistribution,
      gradesAndLevelsDistribution,
      placesChanges,
      ratingChanges,
    };
  }
);

const mapStateToProps = (state, props) => {
  return {
    profile: profileSelector(state, props),
    tracklist: state.tracklist.data,
    filter: state.profiles.filter,
    error: state.results.error || state.tracklist.error,
    isLoading: state.results.isLoading || state.tracklist.isLoading,
  };
};

const mapDispatchToProps = {
  fetchResults,
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

  state = {
    isLevelGraphCombined: true,
    showFaq: false,
  };

  componentWillUnmount() {
    this.props.resetProfilesFilter();
  }

  onRefresh = () => {
    const { isLoading } = this.props;
    !isLoading && this.props.fetchResults();
  };

  onChangeDayRange = range => {
    const { filter } = this.props;
    this.props.setProfilesFilter({
      ...filter,
      dayRange: range,
    });
  };

  onShowFaq = () => {
    this.setState({ showFaq: true });
  };

  onHideFaq = () => {
    this.setState({ showFaq: false });
  };

  renderRankingHistory() {
    const { profile } = this.props;
    return (
      <ResponsiveContainer minHeight={MIN_GRAPH_HEIGHT} aspect={1.6}>
        <LineChart data={profile.ratingChanges} margin={{ top: 5, bottom: 5, right: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={value => parseDate(value).toLocaleDateString()}
          />
          <YAxis
            allowDecimals={false}
            domain={['dataMin - 100', 'dataMax + 100']}
            tickFormatter={Math.round}
            width={40}
          />
          <ReferenceLine y={1000} stroke="white" />
          <RechartsTooltip
            isAnimationActive={false}
            content={({ active, payload, label }) => {
              if (!payload || !payload[0]) {
                return null;
              }
              return (
                <div className="history-tooltip">
                  <div>{parseDate(payload[0].payload.date).toLocaleDateString()}</div>
                  {payload && payload[0] && <div>Rating: {Math.round(payload[0].value)}</div>}
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            isAnimationActive={false}
            dataKey="rating"
            stroke="#88d3ff"
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
      <ResponsiveContainer minHeight={MIN_GRAPH_HEIGHT} aspect={1.6}>
        <LineChart data={profile.placesChanges} margin={{ top: 5, bottom: 5, right: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={value => parseDate(value).toLocaleDateString()}
          />
          <YAxis
            allowDecimals={false}
            domain={[1, dataMax => (dataMax < 3 ? dataMax + 2 : dataMax + 1)]}
            interval={0}
            reversed
            width={40}
          />
          <RechartsTooltip
            isAnimationActive={false}
            content={({ active, payload, label }) => {
              if (!payload || !payload[0]) {
                return null;
              }
              return (
                <div className="history-tooltip">
                  <div>{parseDate(payload[0].payload.date).toLocaleDateString()}</div>
                  {payload && payload[0] && <div>Place: #{payload[0].value}</div>}
                </div>
              );
            }}
          />
          <Line
            isAnimationActive={false}
            type="stepAfter"
            dataKey="place"
            stroke="#88d3ff"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  renderGrades() {
    const { profile } = this.props;
    return (
      <ResponsiveContainer minHeight={MIN_GRAPH_HEIGHT} aspect={1.6}>
        <BarChart
          data={profile.gradesDistribution}
          margin={{ top: 5, bottom: 5, right: 5, left: 0 }}
        >
          <RechartsTooltip
            isAnimationActive={false}
            content={({ active, payload, label }) => {
              if (!payload || !payload[0]) {
                return null;
              }
              return (
                <div className="history-tooltip">
                  <div>Level: {payload[0].payload.x}</div>
                  {_.filter(item => item.value > 0, payload).map(item => (
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
          <Bar dataKey="SSS" fill="#ffd700" stackId="stack" />
          <Bar dataKey="SS" fill="#dab800" stackId="stack" />
          <Bar dataKey="S" fill="#b19500" stackId="stack" />
          <Bar dataKey="A+" fill="#396eef" stackId="stack" />
          <Bar dataKey="A" fill="#828fb7" stackId="stack" />
          <Bar dataKey="B" fill="#7a6490" stackId="stack" />
          <Bar dataKey="C" fill="#6d5684" stackId="stack" />
          <Bar dataKey="D" fill="#5d4e6d" stackId="stack" />
          <Bar dataKey="F" fill="#774949" stackId="stack" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  renderGradesWithLevels() {
    const { profile, tracklist } = this.props;
    return (
      <ResponsiveContainer minHeight={MIN_GRAPH_HEIGHT} aspect={0.74}>
        <BarChart
          data={profile.gradesAndLevelsDistribution}
          margin={{ top: 5, bottom: 5, right: 5, left: 0 }}
          stackOffset="sign"
        >
          <RechartsTooltip
            isAnimationActive={false}
            content={({ active, payload, label }) => {
              if (!payload || !payload[0]) {
                return null;
              }
              const doubleItems = _.filter(
                item => item.value !== 0 && item.dataKey.startsWith('D'),
                payload
              );
              const singleItems = _.filter(
                item => item.value !== 0 && item.dataKey.startsWith('S'),
                payload
              );
              return (
                <div className="history-tooltip">
                  <div>Level: {payload[0].payload.x}</div>
                  {!!singleItems.length && (
                    <>
                      <div>Single:</div>
                      {singleItems.map(item => (
                        <div key={item.name} style={{ fontWeight: 'bold', color: item.color }}>
                          {item.name.slice(2)}: {Math.round(Math.abs(item.value))}% (
                          {Math.round((tracklist.singlesLevels[item.payload.x] * item.value) / 100)}
                          /{tracklist.singlesLevels[item.payload.x]})
                        </div>
                      ))}
                    </>
                  )}
                  {!!doubleItems.length && (
                    <>
                      <div>Double:</div>
                      {doubleItems.map(item => (
                        <div key={item.name} style={{ fontWeight: 'bold', color: item.color }}>
                          {item.name.slice(2)}: {Math.round(Math.abs(item.value))}% (
                          {Math.round(
                            (tracklist.doublesLevels[item.payload.x] * -item.value) / 100
                          )}
                          /{tracklist.doublesLevels[item.payload.x]})
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            }}
          />
          <XAxis dataKey="x" />
          <YAxis
            tickFormatter={x => `${Math.round(Math.abs(x))}%`}
            width={40}
            domain={[dataMin => Math.min(dataMin, -10), dataMax => Math.max(10, dataMax)]}
          />
          <Bar dataKey="S-SSS" fill="#ffd700" stackId="stack" />
          <Bar dataKey="S-SS" fill="#dab800" stackId="stack" />
          <Bar dataKey="S-S" fill="#b19500" stackId="stack" />
          <Bar dataKey="S-A+" fill="#396eef" stackId="stack" />
          <Bar dataKey="S-A" fill="#828fb7" stackId="stack" />
          <Bar dataKey="S-B" fill="#7a6490" stackId="stack" />
          <Bar dataKey="S-C" fill="#6d5684" stackId="stack" />
          <Bar dataKey="S-D" fill="#5d4e6d" stackId="stack" />
          <Bar dataKey="S-F" fill="#774949" stackId="stack" />
          <Bar dataKey="D-SSS" fill="#ffd700" stackId="stack" />
          <Bar dataKey="D-SS" fill="#dab800" stackId="stack" />
          <Bar dataKey="D-S" fill="#b19500" stackId="stack" />
          <Bar dataKey="D-A+" fill="#396eef" stackId="stack" />
          <Bar dataKey="D-A" fill="#828fb7" stackId="stack" />
          <Bar dataKey="D-B" fill="#7a6490" stackId="stack" />
          <Bar dataKey="D-C" fill="#6d5684" stackId="stack" />
          <Bar dataKey="D-D" fill="#5d4e6d" stackId="stack" />
          <Bar dataKey="D-F" fill="#774949" stackId="stack" />
          <Label value="Double" offset={0} position="insideBottomLeft" />
          <Label value="Single" offset={0} position="insideTopLeft" />
          <ReferenceLine y={0} stroke="#bbb" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  renderLevels() {
    const { profile, tracklist } = this.props;
    return (
      <ResponsiveContainer minHeight={MIN_GRAPH_HEIGHT} aspect={1.6}>
        <BarChart
          data={profile.levelsDistribution}
          stackOffset="sign"
          margin={{ top: 5, bottom: 5, right: 5, left: 0 }}
        >
          <RechartsTooltip
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
          <YAxis
            tickFormatter={x => Math.round(Math.abs(x)) + '%'}
            width={40}
            domain={[dataMin => Math.min(dataMin, -10), dataMax => Math.max(10, dataMax)]}
          />
          <RechartsTooltip />
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
    const minNumber = obj[`${grade}-bonus-level-min-number`];
    const currentNumber = obj[`${grade}-bonus-level-achieved-number`];
    const levelString = obj[`${grade}-bonus-level`]
      ? `${typeLetter}${obj[`${grade}-bonus-level`]}`
      : '?';
    return (
      <div className="grade-block">
        <div className="grade-letter">
          <img src={`${process.env.PUBLIC_URL}/grades/${grade}.png`} alt={grade} />
        </div>
        <div className="grade-level">{levelString}</div>
        <div className="grade-progress">
          {progr}% ({progr === 100 ? minNumber : currentNumber}/{minNumber})
        </div>
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

  renderAchievement(achName, achievement) {
    const Icon = achievements[achName].icon;
    const description = achievements[achName].description;
    return (
      <Tooltip
        key={achName}
        content={<div>{description}</div>}
        tooltipClassName="pumpking-tooltip achievement-tooltip"
      >
        <div className="ach-block">
          {Icon && (
            <div className="ach-icon">
              <Icon />
            </div>
          )}
          <div className="ach-name">{achName}</div>
          <div
            className={classNames('progress-background', {
              complete: achievement.progress === 100,
              zero: achievement.progress === 0,
            })}
            style={{
              height: `${Math.round(achievement.progress)}%`,
            }}
          />
        </div>
      </Tooltip>
    );
  }

  render() {
    const { isLoading, profile, error, filter } = this.props;
    const { isLevelGraphCombined } = this.state;

    if (_.isEmpty(profile)) {
      return null;
    }

    const expProgress = profile.expRankNext
      ? (profile.exp - profile.expRank.threshold) /
        (profile.expRankNext.threshold - profile.expRank.threshold)
      : 100;
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
          {isLoading && <Loader />}
          {!isLoading && (
            <div className="profile">
              <div className="profile-header">
                <div className="profile-name text-with-header">
                  <div className="text-header">игрок</div>
                  <div>{profile.name}</div>
                </div>
                <div className="text-with-header">
                  <div className="text-header">ранк</div>
                  <div>#{profile.rank}</div>
                </div>
                <div className="text-with-header">
                  <div className="text-header">эло</div>
                  <div>{profile.rating}</div>
                </div>
                <div className="text-with-header">
                  <div className="text-header">последняя игра</div>
                  <div>
                    {profile.lastResultDate ? getTimeAgo(profile.lastResultDate) : 'никогда'}
                  </div>
                </div>
              </div>
              <div className="profile-section">
                <div className="profile-sm-section-header _flex-row _align-center">
                  <span>опыт</span>
                  <div className="_flex-fill" />
                  <div onClick={this.onShowFaq} className="_clickable">
                    <FaQuestionCircle onClick={this.onShowFaq} />
                  </div>
                  <ReactModal
                    ariaHideApp={false}
                    className="Modal faq-modal"
                    overlayClassName="Overlay"
                    isOpen={this.state.showFaq}
                    onRequestClose={this.onHideFaq}
                  >
                    <div className="close-btn" onClick={this.onHideFaq}>
                      <FaTimes />
                    </div>{' '}
                    <ExpFaq />
                  </ReactModal>
                </div>
                <div className="exp-range">
                  <div className="rank exp-rank">
                    {getRankImg(profile.expRank)}
                    {profile.expRank && <div>{profile.expRank.threshold}</div>}
                  </div>
                  <div className="exp-line-with-label">
                    <div className="exp-label">
                      {profile.expRankNext ? (
                        <>
                          <span className="taken-num">
                            {Math.round(profile.exp - profile.expRank.threshold)}
                          </span>
                          {` / ${profile.expRankNext.threshold - profile.expRank.threshold}`}
                        </>
                      ) : null}
                    </div>
                    <div className="exp-line">
                      <div
                        className="taken"
                        style={{ width: Math.floor(100 * expProgress) + '%' }}
                      ></div>
                      <div
                        className="rest"
                        style={{ width: 100 - Math.ceil(100 * expProgress) + '%' }}
                      ></div>
                    </div>
                    <div className="exp-label">
                      total: <span className="taken-num">{Math.round(profile.exp)}</span>
                    </div>
                  </div>
                  {profile.expRankNext && (
                    <div className="rank exp-rank">
                      {getRankImg(profile.expRankNext)}
                      {profile.expRankNext && <div>{profile.expRankNext.threshold}</div>}
                    </div>
                  )}
                </div>
              </div>
              <div className="profile-section-horizontal-container">
                <div className="profile-section">
                  <div className="profile-section-content">
                    {!isLevelGraphCombined ? (
                      <>
                        <div className="profile-section-2">
                          <div className="profile-sm-section-header flex">
                            <span>уровни</span>
                            <div className="toggle-holder">
                              <Toggle
                                className="combine-toggle"
                                checked={isLevelGraphCombined}
                                onChange={() =>
                                  this.setState(state => ({
                                    isLevelGraphCombined: !state.isLevelGraphCombined,
                                  }))
                                }
                              >
                                объединить графики
                              </Toggle>
                            </div>
                          </div>
                          <div className="chart-container">{this.renderLevels()}</div>
                        </div>
                        <div className="profile-section-2">
                          <div className="profile-sm-section-header">
                            <span>оценки</span>
                          </div>
                          <div className="chart-container">{this.renderGrades()}</div>
                        </div>
                      </>
                    ) : (
                      <div className="profile-section-2">
                        <div className="profile-sm-section-header flex">
                          <span>оценки</span>
                          <div className="toggle-holder">
                            <Toggle
                              className="combine-toggle"
                              checked={isLevelGraphCombined}
                              onChange={() =>
                                this.setState(state => ({
                                  isLevelGraphCombined: !state.isLevelGraphCombined,
                                }))
                              }
                            >
                              объединить графики
                            </Toggle>
                          </div>
                        </div>
                        <div className="chart-container single-double-labels">
                          {this.renderGradesWithLevels()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="profile-section">
                  <div className="profile-section-content">
                    <div className="profile-section-2">
                      <div className="profile-sm-section-header">
                        <span>эло</span>
                      </div>
                      <div className="chart-container">{this.renderRankingHistory()}</div>
                    </div>
                    <div className="profile-section-2">
                      <div className="profile-sm-section-header">
                        <span>место в топе</span>
                      </div>
                      <div className="chart-container">{this.renderPlaceHistory()}</div>
                    </div>
                  </div>
                  <div className="range-container">
                    <Range
                      range={filter.dayRange || profile.filterRange}
                      min={profile.minMaxRange[0]}
                      max={profile.minMaxRange[1]}
                      onChange={this.onChangeDayRange}
                    />
                  </div>
                </div>
              </div>
              <div className="profile-section progress-section">
                <div className="profile-sm-section-header">
                  <span>достижения по уровням</span>
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
              <div className="profile-section">
                <div className="profile-sm-section-header">
                  <span>достижения</span>
                </div>
                <div className="achievements">
                  {_.keys(profile.achievements).map(achName =>
                    this.renderAchievement(achName, profile.achievements[achName])
                  )}
                </div>
              </div>
              <div className="profile-section">
                <div className="profile-sm-section-header">
                  <span>часто играемые чарты</span>
                </div>
                <MostPlayed playerId={profile.id} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(Profile));
