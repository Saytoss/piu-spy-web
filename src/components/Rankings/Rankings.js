import React, { Component } from 'react';
import toBe from 'prop-types';
import { connect } from 'react-redux';
import ReactTable from 'react-table';
import matchSorter from 'match-sorter';
import { Range, getTrackBackground } from 'react-range';
import _ from 'lodash/fp';
import { createSelector } from 'reselect';
import Select from 'react-select';

import Overlay from 'components/Overlay/Overlay';
import ToggleButton from 'components/ToggleButton/ToggleButton';

import 'react-table/react-table.css';
import './rankings.scss';

import { fetchTopScores } from 'reducers/top';

const chartMinMax = [1, 29];

function ChartFilter({ column, filter, onChange }) {
  const filterValue = filter && filter.value;
  const range = _.getOr(chartMinMax, 'value.range', filter);
  const type = _.getOr(null, 'value.type', filter);
  let buttonText = 'Filter charts';
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

const filterCharts = (filter, rows) => {
  const range = _.getOr(chartMinMax, 'value.range', filter);
  const type = _.getOr(null, 'value.type', filter);

  const filtered = _.flow(
    _.filter(row => {
      return (
        row._original.chartLevel >= range[0] &&
        row._original.chartLevel <= range[1] &&
        (!type || type === row._original.chartType)
      );
    })
  )(rows);
  return filtered;
};

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

  componentDidMount() {
    const { isLoading } = this.props;
    if (!isLoading) {
      this.props.fetchTopScores();
    }
  }

  getColumns() {
    const { players } = this.props;
    console.log(players);
    return [
      {
        minWidth: 120,
        maxWidth: 250,
        Header: 'song',
        filterable: true,
        filterMethod: (filter, rows) => {
          return matchSorter(rows, filter.value, { keys: ['song'] });
        },
        filterAll: true,
        accessor: 'song',
      },
      {
        minWidth: 95,
        maxWidth: 95,
        filterable: true,
        filterAll: true,
        Filter: ChartFilter,
        filterMethod: filterCharts,
        accessor: 'chartLabel',
      },
      {
        filterable: true,
        filterMethod: (filter, rows) => {
          const names = _.map('value', _.get('value', filter));
          return _.filter(row => {
            const rowNames = _.map('nickname', row.results);
            return _.every(name => rowNames.includes(name), names);
          }, rows);
        },
        filterAll: true,
        Filter: ({ column, filter, onChange }) => {
          return (
            <Select
              closeMenuOnSelect={false}
              className="select players"
              classNamePrefix="select"
              placeholder="select players"
              isMulti
              options={players}
              value={_.get('value', filter)}
              onChange={onChange}
            />
          );
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
    return (
      <div className="rankings">
        <header></header>
        <div className="content">
          {error && error.message}
          <div className="top-list">
            <ReactTable
              data={data}
              columns={this.getColumns()}
              showPageSizeOptions={false}
              defaultPageSize={20}
              sortable
              resizable={false}
              minRows={4}
              noDataText={isLoading ? 'loading...' : 'no data found'}
              players={players}
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
)(TopScores);
