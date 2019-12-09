import moment from 'moment';

export const parseDate = textDate => {
  if (typeof textDate === 'string') {
    return moment(textDate, 'YYYY-MM-DD HH:mm:ss').toDate();
  } else {
    return new Date(textDate);
  }
};
