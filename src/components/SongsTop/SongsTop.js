import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { FaPlay } from 'react-icons/fa';
import classNames from 'classnames';

// styles
import './songs-top.scss';

// components
import Loader from 'components/Shared/Loader';

// constants

// reducers
import { fetchMostPlayed } from 'reducers/trackStats/mostPlayed';
import { fetchMostPlayedMonth } from 'reducers/trackStats/mostPlayedMonth';
import { fetchLeastPlayed } from 'reducers/trackStats/leastPlayed';

// utils
import { getTimeAgo } from 'utils/leaderboards';
import { parseDate } from 'utils/date';

// code
function TopList({ fetchList, title, renderRightSide }) {
  const [data, setData] = useState([]);
  const [isLoading, setLoading] = useState(false);

  const getRightSide =
    renderRightSide ||
    (item => (
      <div className="playcount">
        <FaPlay />
        <span>{item.countplay}</span>
      </div>
    ));

  useEffect(() => {
    setLoading(true);
    fetchList()
      .then(data => {
        data.success && setData(data.data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [fetchList]);

  return (
    <div className="top-songs-list">
      <div className="top-songs-header">
        <span>{title}</span>
      </div>
      {isLoading && <Loader />}
      {!isLoading &&
        data.map((item, index) => {
          return (
            <div key={item.id} className="top-songs-item">
              <div className={classNames('place', `top-${index + 1}`, { best: index < 3 })}>
                <span>{index + 1}.</span>
              </div>
              <div className="song-name">{item.full_name}</div>
              {getRightSide(item)}
            </div>
          );
        })}
    </div>
  );
}

const leastPlayedRightSide = item => (
  <div className="date">
    <span>{item.last_play ? getTimeAgo(parseDate(item.last_play)) : 'никогда'}</span>
  </div>
);

export default connect(
  null,
  {
    fetchMostPlayed,
    fetchMostPlayedMonth,
    fetchLeastPlayed,
  }
)(function SongsTop({ fetchMostPlayed, fetchMostPlayedMonth, fetchLeastPlayed }) {
  return (
    <div className="songs-top-page">
      <TopList fetchList={fetchMostPlayed} title="топ популярных треков" />
      <TopList fetchList={fetchMostPlayedMonth} title="топ популярных треков за месяц" />
      <TopList
        fetchList={fetchLeastPlayed}
        title="треки, которые долго не играли"
        renderRightSide={leastPlayedRightSide}
      />
      <div className="top-songs-list -placeholder" />
    </div>
  );
});
