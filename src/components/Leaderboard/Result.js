import React from 'react';
import { connect } from 'react-redux';
import { NavLink } from 'react-router-dom';
import _ from 'lodash/fp';
import classNames from 'classnames';
import numeral from 'numeral';
import { FaExclamationTriangle, FaAngleDoubleUp } from 'react-icons/fa';
import Tooltip from 'react-responsive-ui/modules/Tooltip';

import { routes } from 'constants/routes';
import { DEBUG } from 'constants/env';

import Flag from 'components/Shared/Flag';
import Overlay from 'components/Shared/Overlay/Overlay';

import { tooltipFormatter, getTimeAgo } from 'utils/leaderboards';
import { getExp } from 'utils/exp';
import { colorsArray } from 'utils/colors';

const mapStateToProps = (state) => {
  return {
    resultInfo: state.results.resultInfo,
    profiles: state.results.profiles,
  };
};

const Result = (
  {
    // shared
    res,
    chart,
    resultInfo,
    profiles,
    placeDifference,
    // leaderboard
    showProtagonistEloChange = false,
    showProtagonistPpChange = false,
    protagonistName = null,
    uniqueSelectedNames = [],
    // socket
    leftProfile,
    rightProfile,
  },
  ref
) => {
  const inf = resultInfo[res.id] || {};

  // Rating info for nickname column:
  let ratingInfoBlock = null;
  if (DEBUG) {
    // In debug mode we show all info
    ratingInfoBlock = (
      <>
        <span className="debug-elo-info">
          {' '}
          {inf.startingRating && Math.round(inf.startingRating)}
          {' / '}
          {inf.ratingDiff > 0 ? '+' : ''}
          {inf.ratingDiff && Math.round(inf.ratingDiff)}
          {' / '}
          {inf.pp && inf.pp.ppFixed}pp
        </span>
      </>
    );
  } else if (
    res.nickname === protagonistName &&
    (showProtagonistEloChange || showProtagonistPpChange)
  ) {
    // In non-debug mode we show relevant info for selected protagonist
    ratingInfoBlock = (
      <>
        {' / '}
        {showProtagonistEloChange && inf.ratingDiff && (
          <span>{`${inf.ratingDiff > 0 ? '+' : ''}${Math.round(inf.ratingDiff)}`}</span>
        )}
        {showProtagonistPpChange && inf.pp && <span>{inf.pp.ppFixed}pp</span>}
      </>
    );
  }

  const flag = profiles[res.playerId] ? <Flag region={profiles[res.playerId].region} /> : null;

  const nameIndex = uniqueSelectedNames.indexOf(res.nickname);

  return (
    <tr
      key={res.id}
      ref={ref}
      className={classNames({
        empty: !res.isExactDate,
        latest: res.date === chart.latestScoreDate,
      })}
    >
      <td className="place">{res.isSecondOccurenceInResults ? '' : `#${res.topPlace}`}</td>
      <td
        className="nickname"
        style={nameIndex > -1 ? { fontWeight: 'bold', color: colorsArray[nameIndex] } : {}}
      >
        <div className="nickname-container">
          {flag}
          <span className="nickname-text">
            {res.nickname}
            {!!placeDifference && (
              <span className="change-holder up">
                <span>{placeDifference}</span>
                <FaAngleDoubleUp />
              </span>
            )}
            {ratingInfoBlock}
          </span>
        </div>
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
                  <div>наличие ранка на этом результате было угадано, основываясь на скоре</div>
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
              <NavLink exact to={routes.profile.getPath({ id: res.playerId })}>
                {res.nickname} ({res.nicknameArcade})
              </NavLink>
            </div>
            {!!getExp(res, chart) && (
              <div className="important">
                <span className="_grey">опыт: </span>+{numeral(getExp(res, chart)).format('0,0')}
              </div>
            )}
            {_.isNumber(inf.startingRating) && _.isNumber(inf.ratingDiff) && (
              <div className="important">
                <span className="_grey">эло: {inf.startingRating.toFixed(0)} </span>
                {inf.ratingDiff >= 0 ? `+${inf.ratingDiff.toFixed(0)}` : inf.ratingDiff.toFixed(0)}
              </div>
            )}
            {inf.pp && (
              <div className="important">
                <span className="_grey">pp: </span>
                <span>{inf.pp.ppFixed}pp</span>
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
                        <span className="_grey">оригинальный чарт: </span>
                        {res.originalChartLabel}
                      </div>
                    )}
                    {res.originalScore && (
                      <div>
                        <span className="_grey">оригинальный скор: </span>
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
            <img src={`${process.env.PUBLIC_URL}/grades/${res.grade}.png`} alt={res.grade} />
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
        {res.accuracy === 100 ? 100 : res.accuracy ? res.accuracy.toFixed(2) : ''}
        {res.accuracy ? '%' : ''}
      </td>
      <td
        className={classNames('date', {
          latest: res.date === chart.latestScoreDate,
        })}
      >
        <Tooltip content={tooltipFormatter(res)} tooltipClassName="pumpking-tooltip">
          {getTimeAgo(res.dateObject)}
          {res.isExactDate ? '' : '?'}
        </Tooltip>
      </td>
    </tr>
  );
};

export default connect(mapStateToProps, null, null, { forwardRef: true })(React.forwardRef(Result));
