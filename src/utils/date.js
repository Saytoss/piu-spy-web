import moment from 'moment';

export const parseDate = (textDate) => {
  if (typeof textDate === 'string') {
    return moment(textDate).toDate();
  } else {
    return new Date(textDate);
  }
};
