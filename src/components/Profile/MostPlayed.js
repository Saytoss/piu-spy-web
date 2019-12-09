import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import _ from 'lodash/fp';
import { FaPlay } from 'react-icons/fa';
import { MdExpandMore } from 'react-icons/md';

import { fetchJson } from 'utils/fetch';
import { getTimeAgo } from 'utils/leaderboards';
import { parseDate } from 'utils/date';

import Loader from 'components/Shared/Loader';

import { HOST } from 'constants/backend';

import './most-played.scss';

const mapStateToProps = (state, props) => {
  return {
    charts: state.results.sharedCharts,
  };
};

export default connect(mapStateToProps)(({ playerId, charts }) => {
  const [isLoading, setLoading] = useState(false);
  const [limit, setLimit] = useState(10);
  const [data, setData] = useState([]);

  useEffect(() => {
    setLoading(true);
    fetchJson({
      url: `${HOST}/player/${playerId}/mostPlayed?limit=${limit}`,
    })
      .then(result => {
        setLoading(false);
        if (result.success) {
          setData(result.data);
        }
      })
      .catch(() => {
        setLoading(false);
      });
  }, [playerId, limit]);

  return (
    <div className="most-played">
      {isLoading && <Loader />}
      {data.map(item => {
        const chart = charts[item.shared_chart];
        return (
          <div className="chart" key={item.shared_chart}>
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
            <div className="song-name">{chart.song}</div>
            <div className="date">
              {item.latestDate ? getTimeAgo(parseDate(item.latestDate)) : null}
            </div>
            <div className="playcount">
              <FaPlay />
              <span>{item.count}</span>
            </div>
          </div>
        );
      })}
      {limit === _.size(data) && (
        <button
          className="show-more btn btn-sm btn-dark btn-icon"
          onClick={() => setLimit(limit + 10)}
        >
          <MdExpandMore /> больше
        </button>
      )}
    </div>
  );
});
