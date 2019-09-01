import React, { Component } from 'react';
import toBe from 'prop-types';
import { connect } from 'react-redux';
import matchSorter from 'match-sorter';
import { Range, getTrackBackground } from 'react-range';
import _ from 'lodash/fp';
import { createSelector } from 'reselect';
import Select from 'react-select';
import classNames from 'classnames';
import numeral from 'numeral';
import localForage from 'localforage';
import TimeAgo from 'react-timeago';
import ruStrings from 'react-timeago/lib/language-strings/ru';
import buildFormatter from 'react-timeago/lib/formatters/buildFormatter';

import Overlay from 'components/Shared/Overlay/Overlay';
import ToggleButton from 'components/Shared/ToggleButton/ToggleButton';
import Input from 'components/Shared/Input/Input';
import Toggle from 'components/Shared/Toggle/Toggle';

import 'react-table/react-table.css';
import './rankings.scss';

import { fetchTopScores } from 'reducers/top';

import { colorsArray } from 'utils/colors';

const timeAgoFormatter = buildFormatter(ruStrings);

const chartMinMax = [1, 29];

const filterCharts = (filter, rows) => {
  const range = _.getOr(chartMinMax, 'range', filter);
  const type = _.getOr(null, 'type', filter);

  const filtered = _.flow(
    _.filter(row => {
      return (
        row.chartLevel >= range[0] &&
        row.chartLevel <= range[1] &&
        (!type || type === row.chartType)
      );
    })
  )(rows);
  return filtered;
};

const getFilteredData = (data, filter) => {
  const names = _.map('value', filter.players);
  const namesOr = _.map('value', filter.playersOr);
  const namesNot = _.map('value', filter.playersNot);

  return _.flow(
    _.compact([
      filter.chartRange && (items => filterCharts(filter.chartRange, items)),
      filter.song && (items => matchSorter(items, filter.song, { keys: ['song'] })),
      !filter.showRank &&
        _.flow(
          _.map(row => ({ ...row, results: _.filter(res => !res.isRank, row.results) })),
          _.filter(row => _.size(row.results))
        ),
      (names.length || namesOr.length || namesNot.length) &&
        _.filter(row => {
          const rowNames = _.map('nickname', row.results);
          return (
            (!names.length || _.every(name => rowNames.includes(name), names)) &&
            (!namesOr.length || _.some(name => rowNames.includes(name), namesOr)) &&
            (!namesNot.length || !_.some(name => rowNames.includes(name), namesNot))
          );
        }),
    ])
  )(data);
};

function ChartFilter({ filterValue, onChange }) {
  const range = _.getOr(chartMinMax, 'range', filterValue);
  const type = _.getOr(null, 'type', filterValue);
  let buttonText = 'фильтр чартов...';
  if (filterValue) {
    const t = type || '';
    buttonText = range[0] === range[1] ? `${t}${range[0]}` : `${t}${range[0]} - ${t}${range[1]}`;
  }

  return (
    <div>
      <Overlay
        overlayItem={
          <button className="filter-charts-button btn btn-sm btn-dark">{buttonText}</button>
        }
      >
        <div className="chart-range-overlay">
          <div className="buttons">
            <ToggleButton
              text="S"
              active={!type || type === 'S'}
              onToggle={active => {
                onChange({
                  range,
                  type: !active ? 'D' : null,
                });
              }}
            />
            <ToggleButton
              text="D"
              active={!type || type === 'D'}
              onToggle={active => {
                onChange({
                  range,
                  type: !active ? 'S' : null,
                });
              }}
            />
          </div>
          <Range
            values={range}
            step={1}
            min={chartMinMax[0]}
            max={chartMinMax[1]}
            onChange={r => onChange({ type, range: r })}
            renderTrack={({ props, children }) => (
              <div
                onMouseDown={props.onMouseDown}
                onTouchStart={props.onTouchStart}
                style={{
                  ...props.style,
                  height: '10px',
                  display: 'flex',
                  width: '100%',
                }}
              >
                <div
                  ref={props.ref}
                  style={{
                    height: '6px',
                    width: '100%',
                    borderRadius: '3px',
                    background: getTrackBackground({
                      values: range,
                      colors: ['#ccc', '#337ab7', '#ccc'],
                      min: chartMinMax[0],
                      max: chartMinMax[1],
                    }),
                    alignSelf: 'center',
                  }}
                >
                  {children}
                </div>
              </div>
            )}
            renderThumb={({ props, isDragged }) => (
              <div
                {...props}
                style={{
                  ...props.style,
                  height: '12px',
                  width: '12px',
                  borderRadius: '6px',
                  backgroundColor: '#FFF',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: '0px 2px 3px #AAA',
                }}
              >
                <div
                  style={{
                    height: '6px',
                    width: '6px',
                    borderRadius: '3px',
                    backgroundColor: isDragged ? '#337ab7' : '#CCC',
                  }}
                />
              </div>
            )}
          />
          <div className="inputs">
            <Input
              type="number"
              className="form-control"
              min={chartMinMax[0]}
              max={Math.min(chartMinMax[1], range[1])}
              value={range[0]}
              onBlur={value => {
                onChange({ type, range: [value, range[1]] });
              }}
            />
            <Input
              type="number"
              className="form-control"
              min={Math.max(chartMinMax[0], range[0])}
              max={chartMinMax[1]}
              value={range[1]}
              onBlur={value => onChange({ type, range: [range[0], value] })}
            />
          </div>
        </div>
      </Overlay>
    </div>
  );
}

const playersSelector = createSelector(
  state => state.top.data,
  _.flow(
    _.flatMap(_.get('results')),
    _.map('nickname'),
    _.uniq,
    _.sortBy(_.toLower),
    _.map(name => ({ label: name, value: name }))
  )
);

const mapStateToProps = state => {
  return {
    players: playersSelector(state),
    data: state.top.data,
    error: state.top.error,
    isLoading: state.top.isLoading,
  };
};

const mapDispatchToProps = {
  fetchTopScores,
};

class TopScores extends Component {
  static propTypes = {
    match: toBe.object,
    data: toBe.array,
    error: toBe.object,
    isLoading: toBe.bool.isRequired,
  };

  state = { filter: { showRank: true }, showItemsCount: 10 };

  componentDidMount() {
    const { isLoading } = this.props;
    if (!isLoading) {
      this.props.fetchTopScores();
    }
    localForage
      .getItem('filter')
      .then(filter => filter && this.setState({ filter }))
      .catch(error => console.warn('Cannot get filter from local storage', error));
  }

  setFilter = _.curry((name, value) => {
    this.setState(
      state => ({ filter: { ...state.filter, [name]: value } }),
      () => {
        localForage.setItem('filter', this.state.filter);
      }
    );
  });

  render() {
    const { isLoading, data, error, players } = this.props;
    const { showItemsCount, filter, isAdvancedOpen } = this.state;
    const filteredData = getFilteredData(data, filter);
    const bySong = _.groupBy('song', filteredData);
    const allSongs = _.uniq(_.map(_.get('song'), filteredData));

    const canShowMore = allSongs.length > showItemsCount;
    const songs = _.slice(0, showItemsCount, allSongs);

    const uniqueSelectedNames = _.slice(
      0,
      colorsArray.length,
      _.uniq([..._.map('value', filter.players), ..._.map('value', filter.playersOr)])
    );

    const hasAdvancedFilters = _.size(filter.playersOr) || _.size(filter.playersNot);

    return (
      <div className="rankings">
        <header>leaderboard</header>
        <div className="content">
          {error && error.message}
          <div className="filters">
            <div className="song-name _margin-right">
              <Input
                placeholder="название песни..."
                className="form-control"
                onChange={this.setFilter('song')}
              />
            </div>
            <div className="chart-range _margin-right">
              <ChartFilter
                filterValue={this.state.filter.chartRange}
                onChange={this.setFilter('chartRange')}
              />
            </div>
            {!isAdvancedOpen && (
              <div className="players _margin-right">
                <Select
                  closeMenuOnSelect={false}
                  className="select players"
                  classNamePrefix="select"
                  placeholder="игроки..."
                  isMulti
                  options={players}
                  value={_.getOr(null, 'players', this.state.filter)}
                  onChange={this.setFilter('players')}
                />
              </div>
            )}
            <div className="advanced-btn-holder">
              <button
                className={classNames('btn btn-sm btn-dark', {
                  'red-border': !isAdvancedOpen && hasAdvancedFilters,
                })}
                onClick={() => this.setState({ isAdvancedOpen: !isAdvancedOpen })}
              >
                {isAdvancedOpen ? 'меньше опций ⯅' : 'больше опций ⯆'}
              </button>
            </div>
          </div>
          {isAdvancedOpen && (
            <div className="advanced-filters">
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
                      value={_.getOr(null, 'players', this.state.filter)}
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
                      value={_.getOr(null, 'playersOr', this.state.filter)}
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
                      value={_.getOr(null, 'playersNot', this.state.filter)}
                      onChange={this.setFilter('playersNot')}
                    />
                  </div>
                </div>
              </div>
              <div>
                <Toggle
                  checked={_.getOr(false, 'showRank', this.state.filter)}
                  onChange={this.setFilter('showRank')}
                >
                  показывать скоры на ранке
                </Toggle>
              </div>
            </div>
          )}
          {isLoading && 'Loading...'}
          <div className="top-list">
            {_.isEmpty(songs) && !isLoading && 'ничего не найдено'}
            {songs.map((song, songIndex) => {
              const sortedCharts = _.orderBy(['chartLevel'], ['desc'], bySong[song]);
              const latestSongResultDate = _.flow(
                _.sortBy('latestScoreDate'),
                _.last,
                _.get('latestScoreDate')
              )(sortedCharts);
              return (
                <div className="song-block" key={song}>
                  <div className="song-name">{song}</div>
                  <div className="charts">
                    {sortedCharts.map((chart, chartIndex) => (
                      <div className="chart" key={chart.chartLabel}>
                        <div
                          className={classNames('chart-name', {
                            single: chart.chartType === 'S',
                          })}
                        >
                          {chart.chartType}
                          <span className="chart-separator" />
                          {chart.chartLevel}
                        </div>
                        <div className="results">
                          <table>
                            {chartIndex === 0 && songIndex === 0 && (
                              <thead>
                                <tr className="header-background-block"></tr>
                                <tr>
                                  <th className="place"></th>
                                  <th className="nickname"></th>
                                  <th className="score">score</th>
                                  <th className="number">miss</th>
                                  <th className="number">bad</th>
                                  <th className="number">good</th>
                                  <th className="number">great</th>
                                  <th className="number">perfect</th>
                                  <th className="combo">combo</th>
                                  <th className="rank"></th>
                                  <th className="accuracy">accuracy</th>
                                  <th className="date"></th>
                                </tr>
                              </thead>
                            )}
                            <tbody>
                              {chart.results.map((res, index) => {
                                const nameIndex = uniqueSelectedNames.indexOf(res.nickname);
                                return (
                                  <tr key={res.score + res.nickname}>
                                    <td className="place">#{index + 1}</td>
                                    <td
                                      className="nickname"
                                      style={
                                        nameIndex > -1
                                          ? { fontWeight: 'bold', color: colorsArray[nameIndex] }
                                          : {}
                                      }
                                    >
                                      {res.nickname}
                                    </td>
                                    <td className="score">{numeral(res.score).format('0,0')}</td>
                                    <td className="number miss">{res.miss}</td>
                                    <td className="number bad">{res.bad}</td>
                                    <td className="number good">{res.good}</td>
                                    <td className="number great">{res.great}</td>
                                    <td className="number perfect">{res.perfect}</td>
                                    <td className="combo">
                                      {res.combo}
                                      {res.combo ? 'x' : ''}
                                    </td>
                                    <td className={classNames('rank', { vj: res.isRank })}>
                                      {res.isRank && 'VJ'}
                                    </td>
                                    <td className="accuracy">
                                      {res.accuracy}
                                      {res.accuracy ? '%' : ''}
                                    </td>
                                    <td
                                      className={classNames('date', {
                                        latest: res.date === latestSongResultDate,
                                      })}
                                    >
                                      <TimeAgo date={res.date} formatter={timeAgoFormatter} />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
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
)(TopScores);
