import React, { useEffect, useState, useRef, useCallback } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import numeral from 'numeral';
import _ from 'lodash/fp';
import { FaYoutube, FaAngleDoubleUp } from 'react-icons/fa';
import lev from 'fast-levenshtein';

import './socket.scss';

import { SOCKET_SERVER_IP } from 'constants/backend';
import Loader from 'components/Shared/Loader';

import { fetchResults, appendResultFromSocket, appendNewResults } from 'reducers/results';
import { fetchTopPerSong } from 'reducers/topPerSong';
import { fetchTracklist } from 'reducers/tracklist';

import { getRankImg } from 'utils/exp';
import { preprocessData, getTimeAgo } from './helpers';

// code
const STATE_RESET_TIMEOUT = 10 * 60 * 1000; // 5 minutes

// redux
const mapStateToProps = state => {
  return {
    isLoading:
      state.results.isLoading ||
      state.results.isLoadingRanking ||
      state.tracklist.isLoading ||
      state.topPerSong.isLoading,
    songTopData: state.topPerSong.data,
    error: state.topPerSong.error,
    profiles: state.results.profiles,
  };
};

const mapDispatchToProps = {
  fetchResults,
  fetchTopPerSong,
  fetchTracklist,
  appendNewResults,
  appendResultFromSocket,
};

// component
const renderChartLabel = (type, level) => {
  return (
    <div
      className={classNames('chart-name', {
        single: type === 'S',
        singlep: type === 'SP',
        doublep: type === 'DP',
        double: type === 'D',
        coop: type === 'COOP',
      })}
    >
      <span className="chart-letter">{type}</span>
      <span className="chart-number">{level}</span>
    </div>
  );
};

function TrackerApp({
  isLoading,
  fetchResults,
  fetchTracklist,
  fetchTopPerSong,
  appendResultFromSocket,
  appendNewResults,
  songTopData,
  error,
  profiles,
}) {
  const [message, setMessage] = useState('');
  const [socketErrorMessage, setSocketErrorMessage] = useState('');
  const [isSocketReady, setSocketReady] = useState(false);
  const [isAlive, setAlive] = useState(false);
  const [leftLabel, setLeftLabel] = useState(null);
  const [rightLabel, setRightLabel] = useState(null);
  const [leftPlayer, setLeftPlayer] = useState(null);
  const [rightPlayer, setRightPlayer] = useState(null);
  const [recognizedSongName, setRecognizedSongName] = useState('');

  const socketRef = useRef(null);
  const timeoutResetTokenRef = useRef(null);

  const charts = _.values(_.get('results', preprocessData(songTopData)));
  const leftChart = _.find({ chartLabel: leftLabel }, charts);
  const rightChart = _.find({ chartLabel: rightLabel }, charts);
  const chartsToShow = _.uniq(_.compact([leftChart, rightChart]));

  const topPlayersList = _.flow(
    _.values,
    _.orderBy('ratingRaw', 'desc'),
    items => items.map((it, index) => ({ place: index + 1, ...it }))
  )(profiles);

  let leftProfile = {};
  let rightProfile = {};

  if (leftPlayer) {
    leftProfile = _.minBy(p => lev.get(p.nameArcade, leftPlayer), _.values(profiles)) || {};
  }
  if (rightPlayer) {
    rightProfile = _.minBy(p => lev.get(p.nameArcade, rightPlayer), _.values(profiles)) || {};
  }

  const [leftData, setLeftData] = useState({ name: leftProfile.name, rating: null, exp: null });
  const [rightData, setRightData] = useState({ name: rightProfile.name, rating: null, exp: null });

  const restartTimeout = useCallback(() => {
    setAlive(true);
    if (timeoutResetTokenRef.current) {
      clearTimeout(timeoutResetTokenRef.current);
    }
    timeoutResetTokenRef.current = setTimeout(() => {
      // TODO: reset page
      // this.setState(defaultState);
    }, STATE_RESET_TIMEOUT);
  }, []);

  console.log(leftProfile, rightProfile);

  useEffect(() => {
    if (leftProfile.rating && leftProfile.rating !== leftData.rating) {
      setLeftData({ ...leftData, rating: leftProfile.rating, prevRating: leftData.rating });
    }
    if (leftProfile.exp && leftProfile.exp !== leftData.exp) {
      setLeftData({ ...leftData, exp: leftProfile.exp, prevExp: leftData.exp });
    }
    if (rightProfile.rating && rightProfile.rating !== rightData.rating) {
      setRightData({ ...rightData, rating: rightProfile.rating, prevRating: rightData.rating });
    }
    if (rightProfile.exp && rightProfile.exp !== rightData.exp) {
      setRightData({ ...rightData, exp: rightProfile.exp, prevExp: rightData.exp });
    }
    if (leftData.name !== leftProfile.name) {
      setLeftData({
        ...leftData,
        rating: leftProfile.rating,
        prevRating: null,
        exp: leftProfile.exp,
        prevExp: null,
        name: leftProfile.name,
      });
    }
    if (rightData.name !== rightProfile.name) {
      setRightData({
        ...rightData,
        rating: rightProfile.rating,
        prevRating: null,
        exp: rightProfile.exp,
        prevExp: null,
        name: rightProfile.name,
      });
    }
  }, [
    leftProfile.rating,
    rightProfile.rating,
    leftProfile.exp,
    rightProfile.exp,
    leftProfile.name,
    rightProfile.name,
    leftData,
    rightData,
  ]);

  useEffect(() => {
    fetchTracklist().then(() => {
      fetchResults();
    });
  }, [fetchTracklist, fetchResults]);

  useEffect(() => {
    socketRef.current = new WebSocket(SOCKET_SERVER_IP);
    socketRef.current.onerror = () => {
      setMessage(`Cannot connect to websocket server, please reload the page`);
    };
    socketRef.current.onopen = e => {
      setSocketReady(true);
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    socketRef.current.onmessage = event => {
      restartTimeout();
      try {
        const data = event && event.data && JSON.parse(event.data);
        console.log(data);

        if (data.type === 'result_screen') {
          const songName = data.data.track_name;
          const leftLabel = _.get('left.chart_label', data.data);
          const rightLabel = _.get('right.chart_label', data.data);
          const leftPlayer = _.get('left.result.player_name', data.data);
          const rightPlayer = _.get('right.result.player_name', data.data);
          setLeftPlayer(leftPlayer);
          setRightPlayer(rightPlayer);
          setLeftLabel(leftLabel);
          setRightLabel(rightLabel);
          setRecognizedSongName(songName);
          appendNewResults(); // Fetch results that we don't have here yet (to calculate
          fetchTopPerSong(songName, leftLabel, rightLabel);
        } else if (data.type === 'chart_selected') {
          setSocketErrorMessage(data.data.error || '');
          if (data.data.leftPlayer || data.data.rightPlayer) {
            setLeftPlayer(data.data.leftPlayer);
            setRightPlayer(data.data.rightPlayer);
          }
          if (data.data.leftLabel || data.data.rightLabel) {
            setLeftLabel(data.data.leftLabel);
            setRightLabel(data.data.rightLabel);
            if (data.data.text) {
              // If we have full info, try to fetch if needed
              const newSongName = data.data.text;
              setRecognizedSongName(newSongName);
              console.log('song name', newSongName, recognizedSongName);
              if (recognizedSongName !== newSongName) {
                fetchTopPerSong(newSongName, data.data.leftLabel, data.data.rightLabel);
              }
            }
          }
        }
      } catch (e) {
        console.log('on message error', e);
        setMessage(`Error: ${e.message}`);
      }
    };
  }, [recognizedSongName, fetchTopPerSong, restartTimeout, appendNewResults]);

  useEffect(() => {
    setTimeout(() => {
      socketRef.current.onmessage({
        data:
          '{"type": "chart_selected", "data": {"text": "Uranium", "leftLabel": "D17", "rightLabel": "D20", "leftPlayer": "GRUMD", "rightPlayer": "DINO"}}',
      });
    }, 2000);
  }, []);

  const resultsContainerRef = useRef(null);
  const leftResultRef = useRef(null);
  const rightResultRef = useRef(null);

  useEffect(() => {
    if (resultsContainerRef.current && leftResultRef.current) {
      if (rightResultRef.current) {
        // Both refs
        const left = leftResultRef.current;
        const right = rightResultRef.current;
        const totalSize = {
          w: resultsContainerRef.current.clientWidth,
          h: resultsContainerRef.current.clientHeight,
        };
        const scaleHH = totalSize.w / (left.offsetWidth + right.offsetWidth);
        const scaleHW = totalSize.h / Math.max(left.offsetHeight, right.offsetHeight);
        const scaleWH = totalSize.w / Math.max(left.offsetWidth, right.offsetWidth);
        const scaleWW = totalSize.h / (left.offsetHeight + right.offsetHeight);
        // console.log(scaleHH, scaleHW, scaleWH, scaleWW);
        if (Math.min(scaleHH, scaleHW) > Math.min(scaleWH, scaleWW)) {
          resultsContainerRef.current.style.flexDirection = 'row';
          resultsContainerRef.current.style.alignItems = 'center';
          if (scaleHH > scaleHW) {
            resultsContainerRef.current.style.transform = `scale(${0.98 * scaleHW})`;
          } else {
            resultsContainerRef.current.style.transform = `scale(${0.98 * scaleHH})`;
          }
        } else {
          resultsContainerRef.current.style.flexDirection = 'column';
          resultsContainerRef.current.style.alignItems = 'center';
          if (scaleWH > scaleWW) {
            resultsContainerRef.current.style.transform = `scale(${0.98 * scaleWW})`;
          } else {
            resultsContainerRef.current.style.transform = `scale(${0.98 * scaleWH})`;
          }
        }
      } else {
        // One ref
        const left = leftResultRef.current;
        const totalSize = {
          w: resultsContainerRef.current.clientWidth,
          h: resultsContainerRef.current.clientHeight,
        };
        const scaleW = totalSize.w / left.offsetWidth;
        const scaleH = totalSize.h / left.offsetHeight;
        if (scaleW < scaleH) {
          resultsContainerRef.current.style.transform = `scale(${0.98 * scaleW})`;
        } else {
          resultsContainerRef.current.style.transform = `scale(${0.98 * scaleH})`;
        }
      }
    }
  });

  const renderPlayer = ({ player, profile, label, data, isLeft = false }) => {
    const renderDeltaText = (n, prevN) => {
      if (!prevN || prevN === n) {
        return null;
      }
      const delta = n - prevN;
      return (
        <span className={`change ${delta >= 0 ? 'pos' : 'neg'}`}>
          {delta < 0 ? Math.round(delta) : `+${Math.round(delta)}`}
        </span>
      );
    };

    const renderExpLine = () => {
      if (!profile.expRank || !profile.exp) {
        return null;
      }

      let takenWidth = profile.expRankNext
        ? (profile.exp - profile.expRank.threshold) /
          (profile.expRankNext.threshold - profile.expRank.threshold)
        : 1;
      const emptyWidth = 1 - takenWidth;
      let diffWidth = 0;

      if (data.prevExp) {
        takenWidth = profile.expRankNext
          ? (data.prevExp - profile.expRank.threshold) /
            (profile.expRankNext.threshold - profile.expRank.threshold)
          : 1;
        diffWidth = 1 - emptyWidth - takenWidth;
      }
      return (
        <div className="exp-line">
          <div className="taken" style={{ width: Math.floor(100 * takenWidth) + '%' }}></div>
          <div className="diff" style={{ width: Math.ceil(100 * diffWidth) + '%' }}></div>
          <div className="rest" style={{ width: Math.ceil(100 * emptyWidth) + '%' }}></div>
        </div>
      );
    };

    const playerIndex = _.findIndex({ id: profile.id }, topPlayersList);
    const closestPlayers = topPlayersList.slice(
      Math.max(0, playerIndex - 1),
      Math.min(playerIndex + 2, topPlayersList.length)
    );

    return (
      <div className={`player-container ${isLeft ? 'left' : 'right'}`}>
        {player && (
          <>
            <div className="title-header">player {isLeft ? 1 : 2}:</div>
            <div className="name-with-label">
              <div className="name">{profile.name || player}</div>
              <div className="chart-label">
                {label && renderChartLabel(...label.match(/(\D+)|(\d+)/g))}
              </div>
            </div>
            {data.exp && profile.expRank && (
              <div className="exp exp-rank">
                {getRankImg(profile.expRank)}
                {renderExpLine()}
              </div>
            )}
            {data.exp && (
              <div className="exp-text">
                <span className="_grey-text">exp:</span> {Math.floor(data.exp)}{' '}
                {renderDeltaText(data.exp, data.prevExp)}
              </div>
            )}
            {data.rating && (
              <div className="rating">
                <span className="_grey-text">elo:</span> {Math.floor(data.rating)}{' '}
                {renderDeltaText(data.rating, data.prevRating)}
              </div>
            )}
            <div className="closest-players">
              {_.map(pl => {
                return (
                  <div className={`closest-player ${profile.id === pl.id ? 'current-player' : ''}`}>
                    <div className="place">#{pl.place}</div>
                    <div className="name">{pl.name}</div>
                    <div className="elo">{pl.rating}</div>
                  </div>
                );
              }, closestPlayers)}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="tracker-container">
      <div className="sidebar">
        {renderPlayer({
          player: leftPlayer,
          profile: leftProfile,
          label: leftLabel,
          data: leftData,
          isLeft: true,
        })}
        {/* <div className="song-name">{socketErrorMessage || recognizedSongName}</div> */}
        {renderPlayer({
          player: rightPlayer,
          profile: rightProfile,
          label: rightLabel,
          data: rightData,
        })}
      </div>
      <div className="results" ref={resultsContainerRef}>
        {(error || message) && (
          <div className="error">
            {message}
            <br />
            {error && error.message}
          </div>
        )}
        {isSocketReady &&
          !leftPlayer &&
          !rightPlayer &&
          !socketErrorMessage &&
          !isLoading &&
          _.isEmpty(chartsToShow) &&
          (isAlive ? (
            <div className="msg">Waiting for chart select...</div>
          ) : (
            <div className="offline msg">Recognizer is offline</div>
          ))}
        {isSocketReady &&
          (leftLabel || rightLabel) &&
          !socketErrorMessage &&
          !isLoading &&
          _.isEmpty(chartsToShow) &&
          'No results for this chart'}
        {isLoading && <Loader />}
        {!isLoading &&
          chartsToShow.map((chart, chartIndex) => {
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
              <div
                className="song-block"
                key={chart.song + chart.chartLabel}
                ref={chartIndex === 0 ? leftResultRef : rightResultRef}
              >
                <div className="song-name">
                  {renderChartLabel(chart.chartType, chart.chartLevel)}
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
                        <tbody>
                          {results.map((res, index) => {
                            let placeDifference, newIndex;
                            if (res.scoreIncrease && res.date === chart.latestScoreDate) {
                              const prevScore = res.score - res.scoreIncrease;
                              newIndex = _.findLastIndex(res => res.score > prevScore, results);
                              placeDifference = newIndex - index;
                            }
                            return (
                              <tr
                                key={res.score + res.nickname}
                                className={classNames({
                                  empty: !res.isExactDate,
                                  latest: res.date === chart.latestScoreDate,
                                  left: res.nickname === leftProfile.name,
                                  right: res.nickname === rightProfile.name,
                                })}
                              >
                                <td className="place">
                                  {res.isSecondOccurenceInResults ? '' : `#${res.topPlace}`}
                                </td>
                                <td className="nickname">
                                  {res.nickname}
                                  {!!placeDifference && (
                                    <span className="change-holder up">
                                      <span>{placeDifference}</span>
                                      <FaAngleDoubleUp />
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
                                    <div className="inner">{res.isExactDate ? 'VJ' : 'VJ?'}</div>
                                  )}
                                  {res.isHJ && <div className="inner">HJ</div>}
                                </td>
                                <td className="score">
                                  <span className="score-span">
                                    {res.scoreIncrease > res.score * 0.8 && '*'}
                                    {numeral(res.score).format('0,0')}
                                  </span>
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
                                  {getTimeAgo(res.dateObject)}
                                  {res.isExactDate ? '' : '?'}
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
      </div>
    </div>
  );
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TrackerApp);
