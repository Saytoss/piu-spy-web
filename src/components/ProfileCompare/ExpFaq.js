import React from 'react';

import { ranks, getRankImg } from 'utils/exp';

export default function ExpFaq() {
  return (
    <div className="faq-exp">
      <div className="faq-header">
        <strong>Опыт</strong> игрока основывается на количестве сыгранных песен и чартов.
        <br />
        Чем выше уровень чарта и чем лучше оценка на чарте, тем больше опыта он даёт.
        <br />
        Повторные попытки на тех же чартах не дают больше опыта. Чтобы поднимать свой уровень, играй
        новые треки и чарты.
      </div>
      <div className="faq-header">Список уровней и необходимый опыт для их получения:</div>
      <div className="ranks-list">
        {ranks.map(rank => (
          <div key={rank.threshold} className="rank">
            <div className="exp-rank">{getRankImg(rank)}</div>
            <div className="threshold">{rank.threshold}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
