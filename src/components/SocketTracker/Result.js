import React from 'react';
import classNames from 'classnames';
import { FaAngleDoubleUp } from 'react-icons/fa';
import numeral from 'numeral';

import { getTimeAgo } from './helpers';

export const Result = ({ res, chart, leftProfile, rightProfile, placeDifference, flag }) => {
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
      <td className="nickname">
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
          </span>
        </div>
      </td>
      {/* <td className="pp">
        {pp}
        {pp && <span className="_grey">pp</span>}
      </td> */}
      <td className="score">
        <span className="score-span">
          {res.scoreIncrease > res.score * 0.8 && '*'}
          {numeral(res.score).format('0,0')}
        </span>
      </td>
      <td className="grade">
        <div className="img-holder">
          {res.grade && res.grade !== '?' && (
            <img src={`${process.env.PUBLIC_URL}/grades/${res.grade}.png`} alt={res.grade} />
          )}
          {res.grade === '?' && null}
        </div>
      </td>
      <td
        className={classNames('mods', {
          vj: res.isRank,
          hj: res.isHJ,
        })}
      >
        <div className="mods-container">
          {res.mods &&
            res.mods
              .split(' ')
              .filter((mod) => mod.includes('AV'))
              .map((avMod) => (
                <div className="av-mod">
                  <div className="av-text">AV</div>
                  <div className="av-number">{avMod.replace('AV', '')}</div>
                </div>
              ))}
          {res.isRank && <div className="inner">{res.isExactDate ? 'R' : 'R?'}</div>}
          {res.isHJ && <div className="inner">HJ</div>}
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
};
