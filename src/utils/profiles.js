import _ from 'lodash/fp';
import { createSelector } from 'reselect';

const defaultGradesDistribution = {
  SSS: 0,
  SS: 0,
  S: 0,
  'A+': 0,
  A: 0,
  B: 0,
  C: 0,
  D: 0,
  F: 0,
};
const defaultGradesWithLevelsDistribution = _.flow(
  _.flatMap(type => {
    return _.flow(
      _.toPairs,
      _.map(([grade, value]) => [`${type}-${grade}`, value])
    )(defaultGradesDistribution);
  }),
  _.fromPairs
)(['S', 'D']);

export const profileSelectorCreator = idParamName =>
  createSelector(
    (state, props) => _.toInteger(props.match.params[idParamName]),
    state => state.results.isLoading || state.results.isLoadingRanking,
    state => state.results.profiles,
    state => state.profiles.filter,
    state => state.tracklist.data,
    (id, isLoading, profiles, filter, tracklist) => {
      const profile = profiles[id];
      if (_.isEmpty(profile) || isLoading) {
        return null;
      }
      const levelsDistribution = _.flow(
        _.get('resultsByLevel'),
        _.toPairs,
        _.map(([x, y]) => ({
          x: _.toInteger(x),
          S:
            (_.size(
              _.filter(res => res.chart.chartType === 'S' || res.chart.chartType === 'SP', y)
            ) /
              tracklist.singlesLevels[x]) *
            100,
          D:
            (-_.size(
              _.filter(res => res.chart.chartType === 'D' || res.chart.chartType === 'DP', y)
            ) /
              tracklist.doublesLevels[x]) *
            100,
        }))
      )(profile);
      const gradesData = _.flow(
        _.get('resultsByLevel'),
        _.toPairs,
        _.map(
          _.update('[1].result.grade', grade =>
            grade && grade.includes('+') && grade !== 'A+' ? grade.replace('+', '') : grade
          )
        )
      )(profile);
      const gradesDistribution = _.flow(
        _.map(([x, y]) => ({
          x: _.toInteger(x),
          ...defaultGradesDistribution,
          ..._.omit('?', _.mapValues(_.size, _.groupBy('result.grade', y))),
        })),
        _.map(item => {
          const grades = _.pick(Object.keys(defaultGradesDistribution), item);
          const sum = _.sum(_.values(grades));
          return {
            ...item,
            gradesValues: grades,
            ...(sum === 0 ? grades : _.mapValues(value => (100 * value) / sum, grades)),
          };
        })
      )(gradesData);
      const gradesAndLevelsDistribution = _.flow(
        _.map(([x, y]) => {
          const groupedResults = _.groupBy('result.grade', y);
          const counts = _.omit(
            '?',
            _.mapValues(
              _.countBy(res => {
                return res.chart.chartType === 'S' || res.chart.chartType === 'SP'
                  ? 'S'
                  : res.chart.chartType === 'D' || res.chart.chartType === 'DP'
                  ? 'D'
                  : 'Other';
              }),
              groupedResults
            )
          );
          const reduced = _.reduce(
            (acc, [grade, levelsData]) => {
              const accData = _.flow(
                _.toPairs,
                _.map(([type, count]) => [
                  `${type}-${grade}`,
                  type === 'S'
                    ? (count / tracklist.singlesLevels[x]) * 100
                    : (-count / tracklist.doublesLevels[x]) * 100,
                ]),
                _.fromPairs
              )(levelsData);
              return { ...acc, ...accData };
            },
            {},
            _.toPairs(counts)
          );

          return {
            x: _.toInteger(x),
            ...defaultGradesWithLevelsDistribution,
            ...reduced,
          };
        })
      )(gradesData);
      const rank = 1 + _.findIndex({ id }, _.orderBy(['ratingRaw'], ['desc'], _.values(profiles)));

      return {
        ...profile,
        rank,
        levelsDistribution,
        gradesDistribution,
        gradesAndLevelsDistribution,
      };
    }
  );
