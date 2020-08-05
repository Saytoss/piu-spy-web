import React, { useState } from 'react';
import { connect } from 'react-redux';
import _ from 'lodash/fp';
import { FaYoutube, FaBackward, FaForward } from 'react-icons/fa';
import classNames from 'classnames';
import FlipMove from 'react-flip-move';
import queryString from 'query-string';

import { DEBUG } from 'constants/env';

import Result from './Result';
import ChartLabel from './ChartLabel';

const ANIMATION_DURATION = 250;

const mapStateToProps = (state) => {
  return {
    allResults: state.results.results,
    playersHiddenStatus: state.preferences.data.playersHiddenStatus,
  };
};

const Chart = React.forwardRef(
  (
    {
      allResults,
      playersHiddenStatus = {},
      // shared
      chart: chartOriginal,
      // leaderboards
      showProtagonistEloChange,
      showProtagonistPpChange,
      uniqueSelectedNames,
      protagonistName,
      chartIndex,
      // socket stuff
      interpDiff,
      leftProfile,
      rightProfile,
    },
    ref
  ) => {
    const [overrides, setOverrides] = useState(null);
    const chart = _.first(overrides) || chartOriginal;
    if (DEBUG) {
      console.log(chart, overrides);
    }

    let topPlace = 1;
    const occuredNicknames = [];
    const results = chart.results.map((res, index) => {
      const isPlayerHidden = playersHiddenStatus[res.playerId] || false;
      const isSecondOccurenceInResults = occuredNicknames.includes(res.nickname);
      occuredNicknames.push(res.nickname);
      if (index === 0) {
        topPlace = 1;
      } else if (
        !isSecondOccurenceInResults &&
        res.score !== _.get([index - 1, 'score'], chart.results)
      ) {
        topPlace += 1;
      }
      return {
        ...res,
        topPlace,
        isSecondOccurenceInResults,
        isPlayerHidden,
      };
    });

    const onRedoLatestResult = _.throttle(ANIMATION_DURATION + 10, (chart) => {
      const newOverrides = _.drop(1, overrides);
      setOverrides(_.size(newOverrides) === 1 ? null : newOverrides);
    });

    const onUndoLatestResult = _.throttle(ANIMATION_DURATION + 10, (chart) => {
      if (_.isEmpty(results)) {
        setOverrides(null);
      }
      const undoedResult = _.maxBy('date', results);
      if (!undoedResult) return;

      const undoedPlayerId = undoedResult.playerId;
      const previousPlayerResult = _.findLast(
        (res) =>
          res.playerId === undoedPlayerId &&
          res.sharedChartId === chart.sharedChartId &&
          res.isRank === undoedResult.isRank &&
          res.date < undoedResult.date,
        allResults
      );
      const newResults = _.orderBy(
        'score',
        'desc',
        _.compact(
          _.map((res) => (res.id === undoedResult.id ? previousPlayerResult : res), results)
        )
      );
      const latestScore = _.maxBy('date', newResults);
      const overrideChart = {
        ...chart,
        latestScoreDate: latestScore && latestScore.date,
        results: newResults,
      };
      if (_.isEmpty(newResults)) {
        setOverrides(null);
      } else {
        setOverrides([overrideChart, ...(overrides || [chart])]);
      }
    });

    const isActive = !_.isEmpty(overrides);
    const totalResultsCount = _.countBy((id) => !playersHiddenStatus[id], chart.allResultsIds).true;
    const currentIndex = isActive ? 1 + totalResultsCount - _.size(overrides) : totalResultsCount;
    const canUndo = !(currentIndex === 1 && totalResultsCount === 1);

    return (
      <div className="song-block">
        <div className="song-name">
          <ChartLabel type={chart.chartType} level={chart.chartLevel} />
          <div>
            {chart.song}{' '}
            <span className="_grey-text">
              ({chart.interpolatedDifficulty && chart.interpolatedDifficulty.toFixed(1)})
            </span>
          </div>
          <div className="youtube-link">
            <a
              href={`https://youtube.com/results?${queryString.stringify({
                search_query: `${chart.song} ${chart.chartLabel}`.replace(/( -)|(- )/g, ' '),
              })}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaYoutube />
            </a>
          </div>
          <div className="_flex-fill" />
          <div
            className={classNames('undo-result-button', {
              active: isActive,
            })}
          >
            <FaBackward
              className={classNames('backward-btn', { disabled: !canUndo })}
              onClick={() => canUndo && onUndoLatestResult(chart)}
            />
            <span className="number">
              {currentIndex}/{totalResultsCount}
            </span>
            <FaForward
              className={classNames('forward-btn', { disabled: !isActive })}
              onClick={() => isActive && onRedoLatestResult(chart)}
            />
          </div>
        </div>
        <div className="charts">
          {!_.isEmpty(results) && (
            <div className="chart">
              <div className="results">
                <table>
                  {chartIndex === 0 && (
                    <thead>
                      <tr>
                        <th className="place"></th>
                        <th className="nickname"></th>
                        <th className="judge"></th>
                        <th className="score">score</th>
                        <th className="grade"></th>
                        <th className="number">miss</th>
                        <th className="number">bad</th>
                        <th className="number">good</th>
                        <th className="number">great</th>
                        <th className="number">perfect</th>
                        <th className="combo">combo</th>
                        <th className="accuracy">accuracy</th>
                        <th className="date"></th>
                      </tr>
                    </thead>
                  )}
                  <FlipMove
                    enterAnimation="fade"
                    leaveAnimation="fade"
                    typeName="tbody"
                    maintainContainerHeight
                    duration={ANIMATION_DURATION}
                  >
                    {results.map((res, index) => {
                      const isProtagonist = res.nickname === protagonistName;
                      if (
                        (res.isPlayerHidden && !isProtagonist) ||
                        (res.isUnknownPlayer && index !== 0)
                      ) {
                        return null;
                      }

                      let placeDifference, newIndex;
                      if (res.scoreIncrease && res.date === chart.latestScoreDate) {
                        const prevScore = res.score - res.scoreIncrease;
                        newIndex = _.findLastIndex((res) => res.score > prevScore, results);
                        placeDifference = newIndex - index;
                      }

                      return (
                        <Result
                          key={res.isRank + '_' + res.nickname}
                          chart={chart}
                          results={results}
                          res={res}
                          placeDifference={placeDifference}
                          showProtagonistEloChange={showProtagonistEloChange}
                          showProtagonistPpChange={showProtagonistPpChange}
                          uniqueSelectedNames={uniqueSelectedNames}
                          protagonistName={protagonistName}
                        />
                      );
                    })}
                  </FlipMove>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default connect(mapStateToProps, null, null, { forwardRef: true })(Chart);
