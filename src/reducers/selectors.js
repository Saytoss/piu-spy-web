import _ from 'lodash/fp';
import { createSelector } from 'reselect';
import matchSorter from 'match-sorter';

import { SORT, CHART_MIN_MAX, DURATION_DEFAULT } from 'constants/leaderboard';

export const playersSelector = createSelector(
  state => state.top.players,
  _.flow(
    _.toPairs,
    _.map(([id, { nickname, arcade_name }]) => ({
      label: `${nickname} (${arcade_name})`,
      value: nickname,
    })),
    _.sortBy(it => _.toLower(it.label))
  )
);

const filterCharts = (filter, rows) => {
  const range = _.getOr(CHART_MIN_MAX, 'range', filter);
  const type = _.getOr(null, 'type', filter);
  const duration = _.getOr(DURATION_DEFAULT, 'duration', filter);

  return _.filter(row => {
    if (duration !== DURATION_DEFAULT && !duration.includes(row.duration)) {
      return false;
    }
    return (
      row.chartLevel >= range[0] &&
      row.chartLevel <= range[1] &&
      (!type || row.chartType.startsWith(type))
    );
  }, rows);
};

const getFilteredData = (data, filter) => {
  // const start = performance.now();
  const names = _.map('value', filter.players);
  const namesOr = _.map('value', filter.playersOr);
  const namesNot = _.map('value', filter.playersNot);
  const sortingType = _.get('value', filter.sortingType);
  const protagonist = _.get('value', filter.protagonist);
  const excludeAntagonists = _.map('value', filter.excludeAntagonists);

  const defaultSorting = [_.orderBy(['latestScoreDate'], ['desc'])];
  const newScoresProtagonistSorting = !protagonist
    ? defaultSorting
    : [
        _.orderBy(
          [
            song =>
              _.max(
                _.map(
                  res => (res.nickname === protagonist ? res.dateObject.getTime() : 0),
                  song.results
                )
              ),
          ],
          ['desc']
        ),
      ];
  const protagonistSorting = [
    _.filter(row => _.map('nickname', row.results).includes(protagonist)),
    _.map(row => {
      const protIndex = _.findIndex({ nickname: protagonist }, row.results);
      const protScore = row.results[protIndex].score;
      const enemies = _.flow([
        _.take(protIndex),
        _.uniqBy('nickname'),
        _.remove(res => excludeAntagonists.includes(res.nickname) || res.score === protScore),
      ])(row.results);
      const distance = Math.sqrt(
        _.reduce((dist, enemy) => dist + (enemy.score / protScore - 0.99) ** 2, 0, enemies)
      );
      return {
        ...row,
        distanceFromProtagonist: distance,
      };
    }),
    _.orderBy(['distanceFromProtagonist'], ['desc']),
  ];
  const getScoreSorting = direction => [
    _.filter(row => _.map('nickname', row.results).includes(protagonist)),
    _.orderBy(
      [
        row => {
          return _.getOr(
            direction === 'asc' ? Infinity : -Infinity,
            'ratingDiff',
            _.find({ nickname: protagonist }, row.results)
          );
        },
      ],
      [direction]
    ),
  ];
  const sortingFunctions =
    {
      [SORT.DEFAULT]: defaultSorting,
      [SORT.NEW_SCORES_PLAYER]: newScoresProtagonistSorting,
      [SORT.PROTAGONIST]: protagonistSorting,
      [SORT.RANK_ASC]: getScoreSorting('asc'),
      [SORT.RANK_DESC]: getScoreSorting('desc'),
    }[sortingType] || defaultSorting;

  const result = _.flow(
    _.compact([
      filter.chartRange && (items => filterCharts(filter.chartRange, items)),
      !filter.showRank &&
        _.map(row => ({ ...row, results: _.filter(res => !res.isRank, row.results) })),
      filter.showRank &&
        filter.showOnlyRank &&
        _.map(row => ({ ...row, results: _.filter(res => res.isRank, row.results) })),
      filter.showRank &&
        !filter.showOnlyRank &&
        !filter.showRankAndNorank &&
        _.map(row => {
          const occuredNames = [];
          return {
            ...row,
            results: _.filter(res => {
              const alreadyOccured = occuredNames.includes(res.nickname);
              occuredNames.push(res.nickname);
              return !alreadyOccured;
            }, row.results),
          };
        }),
      (names.length || namesOr.length || namesNot.length) &&
        _.filter(row => {
          const rowNames = _.map('nickname', row.results);
          return (
            (!names.length || _.every(name => rowNames.includes(name), names)) &&
            (!namesOr.length || _.some(name => rowNames.includes(name), namesOr)) &&
            (!namesNot.length || !_.some(name => rowNames.includes(name), namesNot))
          );
        }),
      _.filter(row => _.size(row.results)),
      ...sortingFunctions,
      filter.song && (items => matchSorter(items, filter.song, { keys: ['song'] })),
    ])
  )(data);
  // console.log('Elapsed:', performance.now() - start);
  return result;
};

export const filteredDataSelector = createSelector(
  state => state.top.data,
  state => state.top.filter,
  getFilteredData
);
