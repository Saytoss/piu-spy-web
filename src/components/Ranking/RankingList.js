import React from 'react';
import _ from 'lodash/fp';
import numeral from 'numeral';
import { GiQueenCrown } from 'react-icons/gi';
import { FaAngleDoubleUp, FaAngleDoubleDown } from 'react-icons/fa';

import Loader from 'components/Shared/Loader';

const getGradeImg = grade => (
  <img src={`${process.env.PUBLIC_URL}/grades/${grade}.png`} alt={grade} />
);

export default function RankingList({ ranking, isLoading }) {
  return (
    <div className="ranking-list">
      {_.isEmpty(ranking) && !isLoading && 'ничего не найдено'}
      {isLoading && <Loader />}
      {!isLoading && (
        <table>
          <thead>
            <tr>
              <th className="place"></th>
              <th className="change"></th>
              <th className="name">name</th>
              <th className="rating">elo</th>
              <th className="total-score">total score</th>
              <th className="grades sss">{getGradeImg('SSS')}</th>
              <th className="grades ss">{getGradeImg('SS')}</th>
              <th className="grades s">{getGradeImg('S')}</th>
              <th className="grades a">{getGradeImg('A+')}</th>
              <th className="grades b">{getGradeImg('B')}</th>
              <th className="grades c">{getGradeImg('C')}</th>
              <th className="grades d">{getGradeImg('D')}</th>
              <th className="grades f">{getGradeImg('F')}</th>
              <th className="playcount">scores</th>
              <th className="accuracy">accuracy</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((player, playerIndex) => {
              return (
                <tr className="player" key={player.name}>
                  <td className="place">
                    {playerIndex === 0 ? <GiQueenCrown /> : `#${playerIndex + 1}`}
                  </td>
                  <td className="change">
                    {player.change > 0 && (
                      <div className="change-holder up">
                        <span>{player.change}</span>
                        <FaAngleDoubleUp />
                      </div>
                    )}
                    {player.change < 0 && (
                      <div className="change-holder down">
                        <span>{-player.change}</span>
                        <FaAngleDoubleDown />
                      </div>
                    )}
                    {!!player.change && _.isString(player.change) && (
                      <div className="change-holder text">
                        <span>{player.change}</span>
                      </div>
                    )}
                  </td>
                  <td className="name">{player.name}</td>
                  <td className="rating">{player.rating}</td>
                  <td className="total-score">
                    <div>S: {numeral(player.totalScore.S).format('0,0')}</div>
                    <div>D: {numeral(player.totalScore.D).format('0,0')}</div>
                  </td>
                  <td className="grades sss">{player.grades.SSS}</td>
                  <td className="grades ss">{player.grades.SS}</td>
                  <td className="grades s">{player.grades.S}</td>
                  <td className="grades a">{player.grades.A}</td>
                  <td className="grades b">{player.grades.B}</td>
                  <td className="grades c">{player.grades.C}</td>
                  <td className="grades d">{player.grades.D}</td>
                  <td className="grades f">{player.grades.F}</td>
                  <td className="playcount">{player.count}</td>
                  <td className="accuracy">{player.accuracy ? `${player.accuracy}%` : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
