import React from 'react';
import classNames from 'classnames';
import { FaAngleDoubleUp } from 'react-icons/fa';
import numeral from 'numeral';

export const ResultBlock = ({ res, chart, leftProfile, rightProfile, placeDifference, flag }) => {
  return (
    <div
      className={classNames('result-block', {
        empty: !res.isExactDate,
        latest: res.date === chart.latestScoreDate,
        left: res.nickname === leftProfile.name,
        right: res.nickname === rightProfile.name,
      })}
    >
      <div key={res.score + res.nickname + 1} className={classNames('row-1')}>
        <div className="nickname">
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
        </div>
        <div className="grade">
          <div className="img-holder">
            {res.grade && res.grade !== '?' && (
              <img src={`${process.env.PUBLIC_URL}/grades/${res.grade}.png`} alt={res.grade} />
            )}
            {res.grade === '?' && null}
          </div>
        </div>
        <div className="score">
          <span className="score-span">
            {res.scoreIncrease > res.score * 0.8 && '*'}
            {numeral(res.score).format('0,0')}
          </span>
        </div>
      </div>
      <div key={res.score + res.nickname + 2} className={classNames('row-2')}>
        <div className="mods">
          {res.mods && res.mods.split(' ').filter((mod) => mod.includes('AV'))}
        </div>
        <div className="number miss">{res.miss}</div>
        <div className="number bad">{res.bad}</div>
        <div className="number good">{res.good}</div>
        <div className="number great">{res.great}</div>
        <div className="number perfect">{res.perfect}</div>
        <div className="combo">
          {res.combo}
          {res.combo ? 'x' : ''}
        </div>
        <div className="accuracy">
          {res.accuracy}
          {res.accuracy ? '%' : ''}
        </div>
      </div>
    </div>
  );
};
