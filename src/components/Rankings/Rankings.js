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

import Overlay from 'components/Overlay/Overlay';
import ToggleButton from 'components/ToggleButton/ToggleButton';

import 'react-table/react-table.css';
import './rankings.scss';

import { fetchTopScores } from 'reducers/top';

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
  return _.flow(
    _.compact([
      filter.song && (items => matchSorter(items, filter.song, { keys: ['song'] })),
      names.length &&
        _.filter(row => {
          const rowNames = _.map('nickname', row.results);
          return _.every(name => rowNames.includes(name), names);
        }),
      filter.chartRange && (items => filterCharts(filter.chartRange, items)),
    ])
  )(data);
};

function ChartFilter({ filterValue, onChange }) {
  const range = _.getOr(chartMinMax, 'range', filterValue);
  const type = _.getOr(null, 'type', filterValue);
  let buttonText = 'charts filter...';
  if (filterValue) {
    const t = type || '';
    buttonText = range[0] === range[1] ? `${t}${range[0]}` : `${t}${range[0]}-${t}${range[1]}`;
  }

  return (
    <div>
      <Overlay
        overlayItem={
          <button className="filter-charts-button btn btn-sm btn-primary">{buttonText}</button>
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
    _.sortBy(_.identity),
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

  state = { filter: {}, showItemsCount: 10 };

  componentDidMount() {
    const { isLoading } = this.props;
    if (!isLoading) {
      this.props.fetchTopScores();
    }
  }

  getColumns() {
    return [
      {
        minWidth: 120,
        maxWidth: 250,
        Header: 'song',
        accessor: 'song',
      },
      {
        minWidth: 95,
        maxWidth: 95,
        accessor: 'chartLabel',
      },
      {
        filterMethod: (filter, rows) => {
          const names = _.map('value', _.get('value', filter));
          return _.filter(row => {
            const rowNames = _.map('nickname', row.results);
            return _.every(name => rowNames.includes(name), names);
          }, rows);
        },
        Cell: props => (
          <div>
            {props.original.results.map(res => (
              <div key={res.nickname}>
                {res.nickname} - {res.score}
              </div>
            ))}
          </div>
        ),
        accessor: 'results',
      },
    ];
  }

  render() {
    const { isLoading, data, error, players } = this.props;
    const { showItemsCount, filter } = this.state;
    const filteredData = getFilteredData(data, filter);
    const bySong = _.groupBy('song', filteredData);
    const allSongs = _.keys(bySong);
    const canShowMore = allSongs.length > showItemsCount;
    const songs = _.slice(0, showItemsCount, allSongs);
    return (
      <div className="rankings">
        <header></header>
        <div className="content">
          {error && error.message}
          <div className="filters">
            <div className="song-name">
              <input
                type="text"
                placeholder="song name..."
                className="form-control"
                onChange={e => {
                  const song = e.target.value;
                  this.setState(state => ({ filter: { ...state.filter, song } }));
                }}
              />
            </div>
            <div className="chart-range">
              <ChartFilter
                filterValue={this.state.filter.chartRange}
                onChange={chartRange =>
                  this.setState(state => ({ filter: { ...state.filter, chartRange } }))
                }
              />
            </div>
            <div className="players">
              <Select
                closeMenuOnSelect={false}
                className="select players"
                classNamePrefix="select"
                placeholder="select players..."
                isMulti
                options={players}
                value={_.getOr(null, 'players', this.state.filter)}
                onChange={players =>
                  this.setState(state => ({ filter: { ...state.filter, players } }))
                }
              />
            </div>
          </div>
          {isLoading && 'Loading...'}
          <div className="top-list">
            {songs.map(song => (
              <div className="song-block" key={song}>
                <div className="song-name">{song}</div>
                <div className="charts">
                  {_.orderBy(['chartLevel'], ['desc'], bySong[song]).map(chart => (
                    <div className="chart" key={chart.chartLabel}>
                      <div
                        className={classNames('chart-name', { single: chart.chartType === 'S' })}
                      >
                        {chart.chartLabel}
                      </div>
                      <div className="results">
                        <table>
                          <tbody>
                            {chart.results.map(res => (
                              <tr key={res.score + res.nickname}>
                                <td className="nickname">{res.nickname}</td>
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
                                <td className={res.isRank ? 'rank vj' : 'rank'}>
                                  {res.isRank && 'VJ'}
                                </td>
                                <td className="date">{res.date}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
