import moment from 'moment';

export const parseDate = textDate => {
  return moment(textDate, 'YYYY-MM-DD HH:mm:ss').toDate();
};
