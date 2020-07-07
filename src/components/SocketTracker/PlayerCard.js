import React from 'react';
import _ from 'lodash/fp';
import classNames from 'classnames';

import { getRankImg } from 'utils/exp';
// import { useTracked } from './helpers';

export const ChartLabel = ({ type, level }) => {
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

export const PlayerCard = ({
  player,
  profile,
  label,
  trackedData,
  isLeft = false,
  preferences,
  topPlayersList,
}) => {
  const playersHiddenStatus = _.getOr({}, 'playersHiddenStatus', preferences);

  const renderDeltaText = (n, prevN) => {
    if (!prevN || prevN === n) {
      return null;
    }
    const delta = n - prevN;
    return (
      <span className={`change ${delta >= 0 ? 'pos' : 'neg'}`}>
        {delta < 0 ? delta.toFixed(1) : `+${delta.toFixed(1)}`}
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

    if (trackedData.exp[1]) {
      takenWidth = profile.expRankNext
        ? (trackedData.exp[1] - profile.expRank.threshold) /
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

  const rivals = topPlayersList.filter((pl) => !playersHiddenStatus[pl.id]);
  const playerIndex = _.findIndex({ id: profile.id }, rivals);
  const closestPlayers =
    playerIndex < 0
      ? []
      : rivals.slice(Math.max(0, playerIndex - 2), Math.min(playerIndex + 3, rivals.length));

  // const trackedPlayerTopPlace = useTracked(
  //   _.get('place', rivals[playerIndex]),
  //   profile.name
  //   // (prev, curr) => {
  //   //   if (prev) {
  //   //     console.log('Place update:', profile.name || player, curr, prev);
  //   //   }
  //   // }
  // );

  const [type, level] = label ? label.match(/(\D+)|(\d+)/g) : [];

  return (
    <div className={`player-container ${isLeft ? 'left' : 'right'}`}>
      {player && (
        <>
          {/* <div className="title-header">player {isLeft ? 1 : 2}:</div> */}
          <div className="name-with-label">
            <div className="name">{profile.name || player}</div>
            <div className="chart-label">
              <ChartLabel type={type} level={level} />
            </div>
          </div>
          {profile.exp && profile.expRank && (
            <div className="exp exp-rank">
              {getRankImg(profile.expRank)}
              {renderExpLine()}
            </div>
          )}
          {trackedData.exp[0] && (
            <div className="exp-text">
              <span className="_grey-text">exp:</span>
              <span>{Math.round(trackedData.exp[0])}</span>
              {renderDeltaText(trackedData.exp[0], trackedData.exp[1])}
            </div>
          )}
          {trackedData.elo[0] && (
            <div className="rating">
              <span className="_grey-text">elo:</span>
              <span>{Math.round(trackedData.elo[0])}</span>
              {renderDeltaText(trackedData.elo[0], trackedData.elo[1])}
            </div>
          )}
          {trackedData.pp[0] && (
            <div className="rating">
              <span className="_grey-text">pp:</span>
              <span>{Math.round(trackedData.pp[0])}</span>
              {renderDeltaText(trackedData.pp[0], trackedData.pp[1])}
            </div>
          )}
          <div className="closest-players">
            {_.map((pl) => {
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
