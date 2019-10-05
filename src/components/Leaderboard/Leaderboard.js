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
import { FaRedoAlt, FaExclamationTriangle, FaSearch, FaYoutube } from 'react-icons/fa';

// styles
import 'react-responsive-ui/style.css';
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
import { fetchTopScores, setFilter, resetFilter, defaultFilter } from 'reducers/top';
import { selectPreset, openPreset } from 'reducers/presets';

// utils
import { tooltipFormatter, tooltipFormatterForBests, getTimeAgo } from 'utils/leaderboards';
import { colorsArray } from 'utils/colors';
import { playersSelector, filteredDataSelector } from 'reducers/selectors';

// code
const sortingOptions = [
  {
    label: 'новизне скоров',
    value: SORT.DEFAULT,
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
    filteredData: filteredDataSelector(state),
    data: state.top.data,
    filter: state.top.filter,
    error: state.top.error,
    isLoading: state.top.isLoading,
    presets: state.presets.presets,
    currentPreset: state.presets.currentPreset,
  };
};

const mapDispatchToProps = {
  fetchTopScores,
  setFilter,
  resetFilter,
  selectPreset,
  openPreset,
};

class Leaderboard extends Component {
  static propTypes = {
    match: toBe.object,
    data: toBe.array,
    error: toBe.object,
    isLoading: toBe.bool.isRequired,
  };

  state = { showItemsCount: 20 };

  setFilter = _.curry((name, value) => {
    const filter = { ...this.props.filter, [name]: value };
    this.props.setFilter(filter);
    localForage.setItem('filter', filter);
  });

  resetFilter = () => {
    this.props.resetFilter();
    localForage.setItem('filter', defaultFilter);
  };

  onRefresh = () => {
    const { isLoading } = this.props;
    !isLoading && this.props.fetchTopScores();
  };

  renderSimpleSearch() {
    const { isLoading, filter } = this.props;
    return (
      <div className="simple-search">
        <div className="song-name _margin-right _margin-bottom">
          <Input
            value={filter.song || ''}
            placeholder="название песни..."
            className="form-control"
            onChange={this.setFilter('song')}
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
          <label className="label">сортировать по</label>
          <Select
            placeholder="выберите сортировку"
            className="select"
            classNamePrefix="select"
            clearable={false}
            options={sortingOptions}
            value={_.getOr(sortingOptions[0], 'sortingType', filter)}
            onChange={this.setFilter('sortingType')}
          />
        </div>
        {[SORT.PROTAGONIST, SORT.RANK_ASC, SORT.RANK_DESC].includes(
          _.get('sortingType.value', filter)
        ) && (
          <div>
            <label className="label">протагонист (чьи результаты):</label>
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
    const { isLoading, filteredData, error, filter } = this.props;
    const { showItemsCount } = this.state;
    const canShowMore = filteredData.length > showItemsCount;
    const visibleData = _.slice(0, showItemsCount, filteredData);

    const hasProtagonist = [SORT.PROTAGONIST, SORT.RANK_ASC, SORT.RANK_DESC].includes(
      _.get('sortingType.value', filter)
    );
    const protagonistName = _.get('protagonist.value', filter);
    const uniqueSelectedNames = _.slice(
      0,
      colorsArray.length,
      _.uniq(
        _.compact([
          hasProtagonist && protagonistName,
          ..._.map('value', filter.players),
          ..._.map('value', filter.playersOr),
        ])
      )
    );

    return (
      <div className="leaderboard-page">
        <div className="content">
          {error && error.message}
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
            {_.isEmpty(filteredData) && !isLoading && 'ничего не найдено'}
            {!isLoading &&
              visibleData.map((chart, chartIndex) => {
                return (
                  <div className="song-block" key={chart.song + chart.chartLabel}>
                    <div className="song-name">
                      <div
                        className={classNames('chart-name', {
                          single: chart.chartType === 'S',
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
                    </div>
                    <div className="charts">
                      <div className="chart">
                        <div className="results">
                          <table>
                            {chartIndex === 0 && (
                              <thead>
                                <tr>
                                  <th className="place"></th>
                                  <th className="nickname"></th>
                                  <th className="rank"></th>
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
                            <tbody>
                              {chart.results.map(res => {
                                const nameIndex = uniqueSelectedNames.indexOf(res.nickname);
                                return (
                                  <tr
                                    key={res.score + res.nickname}
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
                                      <Tooltip
                                        content={<div>{res.nicknameArcade}</div>}
                                        tooltipClassName="timeago-tooltip"
                                      >
                                        {res.nickname}
                                      </Tooltip>

                                      {DEBUG && (
                                        <span>
                                          {' '}
                                          {res.startingRating &&
                                            Math.round(res.startingRating)}{' '}
                                          {res.ratingDiff && Math.round(res.ratingDiff)}{' '}
                                          {res.ratingDiffLast && Math.round(res.ratingDiffLast)}
                                        </span>
                                      )}
                                      {!DEBUG &&
                                        hasProtagonist &&
                                        res.nickname === protagonistName &&
                                        res.ratingDiff && (
                                          <span>
                                            {` (${res.ratingDiff > 0 ? '+' : ''}${Math.round(
                                              res.ratingDiff
                                            )})`}
                                          </span>
                                        )}
                                      {_.get('sortingType.value', filter) === SORT.PROTAGONIST &&
                                        res.nickname === protagonistName &&
                                        chart.distanceFromProtagonist > 0 && (
                                          <span className="protagonist-diff">
                                            {' '}
                                            -{(chart.distanceFromProtagonist * 100).toFixed(1)}%
                                          </span>
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
                                              tooltipClassName="timeago-tooltip"
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
                                          <span>{numeral(res.score).format('0,0')}</span>
                                        }
                                        placement="top"
                                      >
                                        <div className="score-overlay">
                                          <div>
                                            <span className="_grey">игрок: </span>
                                            <NavLink
                                              exact
                                              to={routes.profile.getPath({ name: res.nickname })}
                                            >
                                              {res.nickname} ({res.nicknameArcade})
                                            </NavLink>
                                          </div>
                                          {!res.isExactDate && (
                                            <div className="warning">
                                              <FaExclamationTriangle />
                                              рекорд взят с my best. часть данных недоступна
                                            </div>
                                          )}
                                          {res.isExactDate && (
                                            <>
                                              <div>
                                                <span className="_grey">моды: </span>
                                                {res.mods || '—'}
                                              </div>
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
                                        content={
                                          res.isExactDate
                                            ? tooltipFormatter(res.dateObject)
                                            : tooltipFormatterForBests(res.dateObject)
                                        }
                                        tooltipClassName="timeago-tooltip"
                                      >
                                        {getTimeAgo(res.dateObject)}
                                        {res.isExactDate ? '' : '?'}
                                      </Tooltip>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
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
