import React from 'react';
import TimeAgo from 'javascript-time-ago';
import ru from 'javascript-time-ago/locale/ru';
import { convenient } from 'javascript-time-ago/gradation';
import moment from 'moment';

TimeAgo.addLocale(ru);
const timeAgo = new TimeAgo('ru-RU');

const timeStyle = {
  flavour: 'long',
  gradation: convenient,
  units: ['day', 'week', 'month'],
};
export const tooltipFormatter = result => {
  if (!result.isExactDate) {
    const resultType =
      result.isMyBest === undefined && result.isMachineBest === undefined
        ? 'с my best или machine best'
        : result.isMyBest
        ? 'с my best'
        : result.isMachineBest
        ? 'с machine best'
        : 'хз откуда';
    return (
      <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
        <div>точная дата взятия неизвестна</div>
        <div>скор был записан {resultType}</div>
        <div>дата записи: {result.dateObject.toLocaleDateString()}</div>
      </div>
    );
  } else {
    return result.dateObject.toLocaleDateString();
  }
};

export const getTimeAgo = date => {
  const dayDiff = moment()
    .startOf('day')
    .diff(moment(date).startOf('day'), 'days');
  return dayDiff === 0 ? 'сегодня' : dayDiff === 1 ? 'вчера' : timeAgo.format(date, timeStyle);
};
