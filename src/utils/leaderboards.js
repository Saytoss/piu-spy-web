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
export const tooltipFormatter = date => date.toLocaleDateString();
export const tooltipFormatterForBests = date => (
  <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
    <div>точная дата взятия неизвестна</div>
    <div>скор был записан с my best или machine best</div>
    <div>дата записи: {date.toLocaleDateString()}</div>
  </div>
);

export const getTimeAgo = date => {
  const dayDiff = moment()
    .startOf('day')
    .diff(moment(date).startOf('day'), 'days');
  return dayDiff === 0 ? 'сегодня' : dayDiff === 1 ? 'вчера' : timeAgo.format(date, timeStyle);
};
