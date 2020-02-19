import React, { Component } from 'react';
import toBe from 'prop-types';
import { connect } from 'react-redux';
import _ from 'lodash/fp';
import Select from 'react-select';
import classNames from 'classnames';
import numeral from 'numeral';
import localForage from 'localforage';
import { NavLink } from 'react-router-dom';
import Tooltip from 'react-responsive-ui/modules/Tooltip';
import {
  FaRedoAlt,
  FaExclamationTriangle,
  FaSearch,
  FaYoutube,
  FaAngleDoubleUp,
  FaBackward,
  FaForward,
} from 'react-icons/fa';
import FlipMove from 'react-flip-move';

// styles
import './leaderboard.scss';

// components
import Overlay from 'components/Shared/Overlay/Overlay';
import ToggleButton from 'components/Shared/ToggleButton/ToggleButton';
import Loader from 'components/Shared/Loader';
import Input from 'components/Shared/Input/Input';
import Toggle from 'components/Shared/Toggle/Toggle';
import CollapsibleBar from 'components/Shared/CollapsibleBar';
import ChartFilter from './ChartFilter';
import PresetsControl from './PresetsControl';

// constants
import { routes } from 'constants/routes';
import { SORT } from 'constants/leaderboard';
import { DEBUG } from 'constants/env';

// reducers
import { fetchResults, setFilter, resetFilter, defaultFilter } from 'reducers/results';
import { selectPreset, openPreset } from 'reducers/presets';

// utils
import { getExp } from 'utils/exp';
import { tooltipFormatter, getTimeAgo } from 'utils/leaderboards';
import { colorsArray } from 'utils/colors';
import { playersSelector, filteredDataSelector } from 'reducers/selectors';

// code
const ANIMATION_DURATION = 250;
const sortingOptions = [
  {
    label: 'от новых скоров',
    value: SORT.DEFAULT,
  },
  {
    label: 'от новых скоров конкретного игрока',
    value: SORT.NEW_SCORES_PLAYER,
  },
  // {
  //   label: 'отставанию от остальных',
  //   value: SORT.PROTAGONIST,
  // },
  // ...(DEBUG
  //   ? [
  {
    label: 'от худших результатов',
    value: SORT.RANK_ASC,
  },
  {
    label: 'от лучших результатов',
    value: SORT.RANK_DESC,
  },
  //   ]
  // : []),
];

const mapStateToProps = state => {
  return {
    players: playersSelector(state),
    scoreInfo: state.results.scoreInfo,
    results: state.results.results,
    filteredData: filteredDataSelector(state),
    data: state.results.data,
    filter: state.results.filter,
    error: state.results.error || state.tracklist.error,
    isLoading: state.results.isLoading || state.tracklist.isLoading,
    presets: state.presets.presets,
    currentPreset: state.presets.currentPreset,
  };
};

const mapDispatchToProps = {
  fetchResults,
  setFilter,
  resetFilter,
  selectPreset,
  openPreset,
};

class Leaderboard extends Component {
  static propTypes = {
    match: toBe.object,
    scoreInfo: toBe.object,
    data: toBe.array,
    error: toBe.object,
    results: toBe.array,
    isLoading: toBe.bool.isRequired,
  };

  state = { showItemsCount: 20, chartOverrides: {} };

  setFilter = _.curry((name, value) => {
    const filter = { ...this.props.filter, [name]: value };
    this.props.setFilter(filter);
    localForage.setItem('filter', filter);
  });

  resetFilter = () => {
    this.props.resetFilter();
    this.setState({ chartOverrides: {} });
    localForage.setItem('filter', defaultFilter);
  };

  onRefresh = () => {
    const { isLoading } = this.props;
    this.setState({ chartOverrides: {} });
    !isLoading && this.props.fetchResults();
  };

  onTypeSongName = _.debounce(300, value => {
    this.setFilter('song', value);
  });

  onRedoLatestResult = _.throttle(ANIMATION_DURATION + 10, chart => {
    const overrides = _.drop(1, this.state.chartOverrides[chart.sharedChartId]);
    this.setState(state => ({
      chartOverrides: {
        ...state.chartOverrides,
        [chart.sharedChartId]: _.size(overrides) === 1 ? null : overrides,
      },
    }));
  });

  onUndoLatestResult = _.throttle(ANIMATION_DURATION + 10, chart => {
    if (_.isEmpty(chart.results)) {
      this.setState(state => ({
        chartOverrides: _.omit(chart.sharedChartId, state.chartOverrides),
      }));
    }
    const undoedResult = _.maxBy('date', chart.results);
    if (!undoedResult) return;

    const { results } = this.props;
    const undoedPlayerId = undoedResult.playerId;
    const previousPlayerResult = _.findLast(
      res =>
        res.playerId === undoedPlayerId &&
        res.sharedChartId === chart.sharedChartId &&
        res.isRank === undoedResult.isRank &&
        res.date < undoedResult.date,
      results
    );
    const newResults = _.orderBy(
      'score',
      'desc',
      _.compact(_.map(res => (res === undoedResult ? previousPlayerResult : res), chart.results))
    );
    const latestScore = _.maxBy('date', newResults);
    const overrideChart = {
      ...chart,
      latestScoreDate: latestScore && latestScore.date,
      results: newResults,
    };
    if (_.isEmpty(newResults)) {
      this.setState(state => ({
        chartOverrides: {
          ...state.chartOverrides,
          [chart.sharedChartId]: null,
        },
      }));
    } else {
      this.setState(state => ({
        chartOverrides: {
          ...state.chartOverrides,
          [chart.sharedChartId]: [
            overrideChart,
            ...(state.chartOverrides[chart.sharedChartId] || [chart]),
          ],
        },
      }));
    }
  });

  renderSimpleSearch() {
    const { isLoading, filter } = this.props;
    return (
      <div className="simple-search">
        <div className="song-name _margin-right _margin-bottom">
          <Input
            value={filter.song || ''}
            placeholder="название песни..."
            className="form-control"
            onChange={this.onTypeSongName}
          />
        </div>
        <div className="chart-range _margin-right _margin-bottom">
          <ChartFilter filterValue={filter.chartRange} onChange={this.setFilter('chartRange')} />
        </div>
        <div className="_flex-fill" />
        <div className="_flex-row _margin-bottom">
          <PresetsControl />
          <button className="btn btn-sm btn-dark btn-icon _margin-right" onClick={this.resetFilter}>
            <FaRedoAlt /> сбросить фильтры
          </button>
          <button
            disabled={isLoading}
            className="btn btn-sm btn-dark btn-icon"
            onClick={this.onRefresh}
          >
            <FaSearch /> обновить
          </button>
        </div>
      </div>
    );
  }

  renderFilters() {
    const { players, filter } = this.props;

    return (
      <div className="filters">
        <div className="people-filters">
          <label className="label">показывать чарты, которые сыграл:</label>
          <div className="players-block">
            <div className="_margin-right">
              <label className="label">каждый из этих</label>
              <Select
                closeMenuOnSelect={false}
                className="select players"
                classNamePrefix="select"
                placeholder="игроки..."
                isMulti
                options={players}
                value={_.getOr(null, 'players', filter)}
                onChange={this.setFilter('players')}
              />
            </div>
            <div className="_margin-right">
              <label className="label">и хоть один из этих</label>
              <Select
                closeMenuOnSelect={false}
                className="select players"
                classNamePrefix="select"
                placeholder="игроки..."
                isMulti
                options={players}
                value={_.getOr(null, 'playersOr', filter)}
                onChange={this.setFilter('playersOr')}
              />
            </div>
            <div className="_margin-right">
              <label className="label">и никто из этих</label>
              <Select
                closeMenuOnSelect={false}
                className="select players"
                classNamePrefix="select"
                placeholder="игроки..."
                isMulti
                options={players}
                value={_.getOr(null, 'playersNot', filter)}
                onChange={this.setFilter('playersNot')}
              />
            </div>
          </div>
        </div>
        <div>
          <Toggle
            checked={_.getOr(false, 'showRank', filter)}
            onChange={this.setFilter('showRank')}
          >
            показывать скоры на ранке
          </Toggle>
        </div>
        {_.get('showRank', filter) && (
          <>
            <div>
              <Toggle
                checked={_.getOr(false, 'showOnlyRank', filter)}
                onChange={value => {
                  this.setFilter('showOnlyRank', value);
                  if (_.get('showRankAndNorank', filter)) {
                    this.setFilter('showRankAndNorank', false);
                  }
                }}
              >
                <strong>только</strong> на ранке
              </Toggle>
            </div>
            <div>
              <Toggle
                checked={_.getOr(false, 'showRankAndNorank', filter)}
                onChange={value => {
                  this.setFilter('showRankAndNorank', value);
                  if (_.get('showOnlyRank', filter)) {
                    this.setFilter('showOnlyRank', false);
                  }
                }}
              >
                показывать лучшие скоры с ранком и без
              </Toggle>
            </div>
          </>
        )}
      </div>
    );
  }

  renderSortings() {
    const { players, filter } = this.props;
    return (
      <div className="sortings">
        <div>
          <label className="label">сортировка:</label>
          <Select
            placeholder="выберите сортировку"
            className="select"
            classNamePrefix="select"
            isClearable={false}
            options={sortingOptions}
            value={_.getOr(sortingOptions[0], 'sortingType', filter)}
            onChange={this.setFilter('sortingType')}
          />
        </div>
        {[SORT.PROTAGONIST, SORT.RANK_ASC, SORT.RANK_DESC, SORT.NEW_SCORES_PLAYER].includes(
          _.get('sortingType.value', filter)
        ) && (
          <div>
            <label className="label">игрок:</label>
            <Select
              className={classNames('select players', {
                'red-border': !_.get('protagonist', filter),
              })}
              classNamePrefix="select"
              placeholder="игроки..."
              options={players}
              value={_.getOr(null, 'protagonist', filter)}
              onChange={this.setFilter('protagonist')}
            />
          </div>
        )}
        {[SORT.PROTAGONIST].includes(_.get('sortingType.value', filter)) && (
          <div>
            <label className="label">не учитывать в сравнении:</label>
            <Select
              closeMenuOnSelect={false}
              className="select players"
              classNamePrefix="select"
              placeholder="игроки..."
              options={players}
              isMulti
              value={_.getOr([], 'excludeAntagonists', filter)}
              onChange={this.setFilter('excludeAntagonists')}
            />
          </div>
        )}
      </div>
    );
  }

  render() {
    const { isLoading, filteredData, error, filter /* scoreInfo */ } = this.props;
    const { showItemsCount, chartOverrides } = this.state;
    const canShowMore = filteredData.length > showItemsCount;
    const visibleData = _.slice(0, showItemsCount, filteredData);

    const sortingType = _.get('sortingType.value', filter);
    const highlightProtagonist = [
      SORT.PROTAGONIST,
      SORT.RANK_ASC,
      SORT.RANK_DESC,
      SORT.NEW_SCORES_PLAYER,
    ].includes(sortingType);
    const protagonistName = _.get('protagonist.value', filter);
    const uniqueSelectedNames = _.slice(
      0,
      colorsArray.length,
      _.uniq(
        _.compact([
          highlightProtagonist && protagonistName,
          ..._.map('value', filter.players),
          ..._.map('value', filter.playersOr),
        ])
      )
    );

    return (
      <div className="leaderboard-page">
        <div className="content">
          <div className="search-block">
            {this.renderSimpleSearch()}
            <CollapsibleBar title="фильтры">{this.renderFilters()}</CollapsibleBar>
            <CollapsibleBar title="сортировка">{this.renderSortings()}</CollapsibleBar>
          </div>
          {isLoading && <Loader />}
          {!!this.props.presets.length && (
            <div className="presets-buttons">
              <span>пресеты:</span>
              {this.props.presets.map(preset => (
                <ToggleButton
                  key={preset.name}
                  text={preset.name}
                  className="btn btn-sm btn-dark _margin-right"
                  active={_.get('filter', preset) === this.props.filter}
                  onToggle={() => {
                    this.props.selectPreset(preset);
                    this.props.openPreset();
                  }}
                ></ToggleButton>
              ))}
            </div>
          )}
          <div className="top-list">
            {_.isEmpty(filteredData) && !isLoading && (error ? error.message : 'ничего не найдено')}
            {!isLoading &&
              visibleData.map((chartOriginal, chartIndex) => {
                const overrides = chartOverrides[chartOriginal.sharedChartId];
                const chart = _.first(overrides) || chartOriginal;
                if (DEBUG) console.log(chart);
                let topPlace = 1;
                const occuredNicknames = [];
                const results = chart.results.map((res, index) => {
                  const isSecondOccurenceInResults = occuredNicknames.includes(res.nickname);
                  occuredNicknames.push(res.nickname);
                  if (index === 0) {
                    topPlace = 1;
                  } else if (
                    !isSecondOccurenceInResults &&
                    res.score !== _.get([index - 1, 'score'], chart.results)
                  ) {
                    topPlace += 1;
                  }
                  return {
                    ...res,
                    topPlace,
                    isSecondOccurenceInResults,
                  };
                });
                return (
                  <div className="song-block" key={chart.song + chart.chartLabel}>
                    <div className="song-name">
                      <div
                        className={classNames('chart-name', {
                          single: chart.chartType === 'S',
                          singlep: chart.chartType === 'SP',
                          doublep: chart.chartType === 'DP',
                          double: chart.chartType === 'D',
                          coop: chart.chartType === 'COOP',
                        })}
                      >
                        <span className="chart-letter">{chart.chartType}</span>
                        <span className="chart-number">{chart.chartLevel}</span>
                      </div>
                      <div>{chart.song}</div>
                      <div className="youtube-link">
                        <a
                          href={`https://youtube.com/results?search_query=${chart.song
                            .replace(/ /g, '+')
                            .replace(/-/g, '')}+${chart.chartLabel}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FaYoutube />
                        </a>
                      </div>
                      <div className="_flex-fill" />
                      {(() => {
                        const isActive = !_.isEmpty(overrides);
                        const currentIndex = isActive
                          ? 1 + chart.totalResultsCount - _.size(overrides)
                          : chart.totalResultsCount;
                        const canUndo = !(currentIndex === 1 && chart.totalResultsCount === 1);
                        return (
                          <div
                            className={classNames('undo-result-button', {
                              active: isActive,
                            })}
                          >
                            <FaBackward
                              className={classNames('backward-btn', { disabled: !canUndo })}
                              onClick={() => canUndo && this.onUndoLatestResult(chart)}
                            />
                            <span className="number">
                              {currentIndex}/{chart.totalResultsCount}
                            </span>
                            <FaForward
                              className={classNames('forward-btn', { disabled: !isActive })}
                              onClick={() => isActive && this.onRedoLatestResult(chart)}
                            />
                          </div>
                        );
                      })()}
                    </div>
                    <div className="charts">
                      {!_.isEmpty(results) && (
                        <div className="chart">
                          <div className="results">
                            <table>
                              {chartIndex === 0 && (
                                <thead>
                                  <tr>
                                    <th className="place"></th>
                                    <th className="nickname"></th>
                                    <th className="judge"></th>
                                    <th className="score">score</th>
                                    <th className="grade"></th>
                                    <th className="number">miss</th>
                                    <th className="number">bad</th>
                                    <th className="number">good</th>
                                    <th className="number">great</th>
                                    <th className="number">perfect</th>
                                    <th className="combo">combo</th>
                                    <th className="accuracy">accuracy</th>
                                    <th className="date"></th>
                                  </tr>
                                </thead>
                              )}
                              <FlipMove
                                enterAnimation="fade"
                                leaveAnimation="fade"
                                typeName="tbody"
                                maintainContainerHeight
                                duration={ANIMATION_DURATION}
                              >
                                {results.map((res, index) => {
                                  if (res.isUnknownPlayer && index !== 0) {
                                    return null;
                                  }
                                  const nameIndex = uniqueSelectedNames.indexOf(res.nickname);
                                  let placeDifference, newIndex;
                                  if (res.scoreIncrease && res.date === chart.latestScoreDate) {
                                    const prevScore = res.score - res.scoreIncrease;
                                    newIndex = _.findLastIndex(
                                      res => res.score > prevScore,
                                      results
                                    );
                                    placeDifference = newIndex - index;
                                  }
                                  // const inf = scoreInfo[res.id] || {};
                                  return (
                                    <tr
                                      key={res.isRank + '_' + res.nickname}
                                      className={classNames({
                                        empty: !res.isExactDate,
                                        latest: res.date === chart.latestScoreDate,
                                      })}
                                    >
                                      <td className="place">
                                        {res.isSecondOccurenceInResults ? '' : `#${res.topPlace}`}
                                      </td>
                                      <td
                                        className="nickname"
                                        style={
                                          nameIndex > -1
                                            ? { fontWeight: 'bold', color: colorsArray[nameIndex] }
                                            : {}
                                        }
                                      >
                                        {res.nickname}
                                        {!!placeDifference && (
                                          <span className="change-holder up">
                                            <span>{placeDifference}</span>
                                            <FaAngleDoubleUp />
                                          </span>
                                        )}
                                        {res.pp && DEBUG && (
                                          <span className="debug-elo-info">
                                            {' '}
                                            {res.pp.ppFixed}pp
                                          </span>
                                        )}
                                        {res.pp &&
                                          (sortingType === SORT.RANK_DESC ||
                                            sortingType === SORT.RANK_ASC) &&
                                          res.nickname === protagonistName && (
                                            <span> ({res.pp.ppFixed}pp)</span>
                                          )}
                                      </td>
                                      <td
                                        className={classNames('judge', {
                                          vj: res.isRank,
                                          hj: res.isHJ,
                                        })}
                                      >
                                        {res.isRank && (
                                          <div className="inner">
                                            {res.isExactDate ? (
                                              'VJ'
                                            ) : (
                                              <Tooltip
                                                content={
                                                  <div>
                                                    наличие ранка на этом результате было угадано,
                                                    основываясь на скоре
                                                  </div>
                                                }
                                                tooltipClassName="pumpking-tooltip"
                                              >
                                                VJ?
                                              </Tooltip>
                                            )}
                                          </div>
                                        )}
                                        {res.isHJ && <div className="inner">HJ</div>}
                                      </td>
                                      <td className="score">
                                        <Overlay
                                          overlayClassName="score-overlay-outer"
                                          overlayItem={
                                            <span className="score-span">
                                              {/* {res.scoreIncrease > res.score * 0.8 && <FaPlus />} */}
                                              {res.scoreIncrease > res.score * 0.8 && '*'}
                                              {numeral(res.score).format('0,0')}
                                            </span>
                                          }
                                          placement="top"
                                        >
                                          <div className="score-overlay">
                                            {DEBUG && (
                                              <>
                                                <div>
                                                  <span className="_grey">result id: </span>
                                                  {res.id}
                                                </div>
                                                <div>
                                                  <span className="_grey">player id: </span>
                                                  {res.playerId}
                                                </div>
                                              </>
                                            )}
                                            <div>
                                              <span className="_grey">игрок: </span>
                                              <NavLink
                                                exact
                                                to={routes.profile.getPath({ id: res.playerId })}
                                              >
                                                {res.nickname} ({res.nicknameArcade})
                                              </NavLink>
                                            </div>
                                            {!!getExp(res, chart) && (
                                              <div className="important">
                                                <span className="_grey">опыт: </span>+
                                                {numeral(getExp(res, chart)).format('0,0')}
                                              </div>
                                            )}
                                            {res.pp && (
                                              <div className="important">
                                                <span className="_grey">pp: </span>
                                                <span>{res.pp.ppFixed}pp</span>
                                              </div>
                                            )}
                                            {!res.isExactDate && (
                                              <div className="warning">
                                                <FaExclamationTriangle />
                                                рекорд взят с my best. часть данных недоступна
                                              </div>
                                            )}
                                            {!!res.isExactDate && (
                                              <>
                                                {!!res.mods && (
                                                  <div>
                                                    <span className="_grey">моды: </span>
                                                    {res.mods}
                                                  </div>
                                                )}
                                                {!!res.calories && (
                                                  <div>
                                                    <span className="_grey">ккал: </span>
                                                    {res.calories}
                                                  </div>
                                                )}
                                                {!!res.scoreIncrease && (
                                                  <div>
                                                    <span className="_grey">прирост: </span>+
                                                    {numeral(res.scoreIncrease).format('0,0')}
                                                  </div>
                                                )}
                                                {res.originalChartMix && (
                                                  <div>
                                                    <div className="warning">
                                                      <FaExclamationTriangle />
                                                      было сыграно на {res.originalChartMix}
                                                    </div>
                                                    {res.originalChartLabel && (
                                                      <div>
                                                        <span className="_grey">
                                                          оригинальный чарт:{' '}
                                                        </span>
                                                        {res.originalChartLabel}
                                                      </div>
                                                    )}
                                                    {res.originalScore && (
                                                      <div>
                                                        <span className="_grey">
                                                          оригинальный скор:{' '}
                                                        </span>
                                                        {res.originalScore}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                                {res.scoreIncrease > res.score * 0.8 && '* сайтрид'}
                                              </>
                                            )}
                                          </div>
                                        </Overlay>
                                      </td>
                                      <td className="grade">
                                        <div className="img-holder">
                                          {res.grade && res.grade !== '?' && (
                                            <img
                                              src={`${process.env.PUBLIC_URL}/grades/${res.grade}.png`}
                                              alt={res.grade}
                                            />
                                          )}
                                          {res.grade === '?' && null}
                                        </div>
                                      </td>
                                      <td className="number miss">{res.miss}</td>
                                      <td className="number bad">{res.bad}</td>
                                      <td className="number good">{res.good}</td>
                                      <td className="number great">{res.great}</td>
                                      <td className="number perfect">{res.perfect}</td>
                                      <td className="combo">
                                        {res.combo}
                                        {res.combo ? 'x' : ''}
                                      </td>
                                      <td className="accuracy">
                                        {res.accuracy}
                                        {res.accuracy ? '%' : ''}
                                      </td>
                                      <td
                                        className={classNames('date', {
                                          latest: res.date === chart.latestScoreDate,
                                        })}
                                      >
                                        <Tooltip
                                          content={tooltipFormatter(res)}
                                          tooltipClassName="pumpking-tooltip"
                                        >
                                          {getTimeAgo(res.dateObject)}
                                          {res.isExactDate ? '' : '?'}
                                        </Tooltip>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </FlipMove>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            {!isLoading && canShowMore && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() =>
                  this.setState(state => ({ showItemsCount: state.showItemsCount + 10 }))
                }
              >
                show more...
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Leaderboard);
