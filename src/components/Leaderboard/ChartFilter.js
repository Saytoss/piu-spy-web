import React from 'react';
import _ from 'lodash/fp';
import { FaCaretLeft, FaCaretRight } from 'react-icons/fa';

import Overlay from 'components/Shared/Overlay/Overlay';
import ToggleButton from 'components/Shared/ToggleButton/ToggleButton';
import Input from 'components/Shared/Input/Input';
import Range from 'components/Shared/Range';

import { CHART_MIN_MAX } from 'constants/leaderboard';

export default function ChartFilter({ filterValue, onChange }) {
  const range = _.getOr(CHART_MIN_MAX, 'range', filterValue);
  const type = _.getOr(null, 'type', filterValue);
  let buttonText = 'фильтр чартов';
  if (filterValue) {
    const t = type || '';
    buttonText = range[0] === range[1] ? `${t}${range[0]}` : `${t}${range[0]} - ${t}${range[1]}`;
    buttonText = 'чарты: ' + buttonText;
  }

  return (
    <div>
      <Overlay
        overlayClassName="chart-range-overlay-outer"
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
            range={range}
            min={CHART_MIN_MAX[0]}
            max={CHART_MIN_MAX[1]}
            onChange={r => onChange({ type, range: r })}
          />
          <div className="inputs">
            <button
              className="btn btn-sm btn-dark"
              onClick={() =>
                onChange({
                  type,
                  range: [Math.max(range[0] - 1, CHART_MIN_MAX[0]), range[1]],
                })
              }
            >
              <FaCaretLeft />
            </button>
            <Input
              type="number"
              className="form-control"
              min={CHART_MIN_MAX[0]}
              max={Math.min(CHART_MIN_MAX[1], range[1])}
              value={range[0]}
              onBlur={value => {
                onChange({ type, range: [value, range[1]] });
              }}
            />
            <button
              className="btn btn-sm btn-dark"
              onClick={() => {
                const newMin = Math.min(range[0] + 1, CHART_MIN_MAX[1]);
                onChange({
                  type,
                  range: [newMin, range[1] < newMin ? newMin : range[1]],
                });
              }}
            >
              <FaCaretRight />
            </button>
            <div className="_flex-fill" />
            <button
              className="btn btn-sm btn-dark"
              onClick={() => {
                const newMax = Math.max(range[1] - 1, CHART_MIN_MAX[0]);
                onChange({
                  type,
                  range: [range[0] > newMax ? newMax : range[0], newMax],
                });
              }}
            >
              <FaCaretLeft />
            </button>
            <Input
              type="number"
              className="form-control"
              min={Math.max(CHART_MIN_MAX[0], range[0])}
              max={CHART_MIN_MAX[1]}
              value={range[1]}
              onBlur={value => onChange({ type, range: [range[0], value] })}
            />
            <button
              className="btn btn-sm btn-dark"
              onClick={() =>
                onChange({
                  type,
                  range: [range[0], Math.min(range[1] + 1, CHART_MIN_MAX[1])],
                })
              }
            >
              <FaCaretRight />
            </button>
          </div>
        </div>
      </Overlay>
    </div>
  );
}
