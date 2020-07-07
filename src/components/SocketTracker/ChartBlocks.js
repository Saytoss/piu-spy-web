import React from 'react';
import _ from 'lodash/fp';

import './charts-blocks.scss';

import Flag from 'components/Shared/Flag';
import { ResultBlock } from './ResultBlock';
import { ChartLabel } from './PlayerCard';

export const ChartBlocks = React.forwardRef(
  ({ chart, results, interpDiff, profiles, leftProfile, rightProfile }, ref) => {
    return (
      <div className="song-block" key={chart.song + chart.chartLabel} ref={ref}>
        <div className="song-name">
          <ChartLabel type={chart.chartType} level={chart.chartLevel} />
          <div>
            {interpDiff ? `(${interpDiff.toFixed(1)}) ` : ''}
            {chart.song}
          </div>
        </div>
        <div className="charts-blocks">
          {results.map((res, index) => {
            let placeDifference, newIndex;
            if (res.scoreIncrease && res.date === chart.latestScoreDate) {
              const prevScore = res.score - res.scoreIncrease;
              newIndex = _.findLastIndex((res) => res.score > prevScore, results);
              placeDifference = newIndex - index;
            }
            // const pp = _.getOr('', `[${res.id}].pp.ppFixed`, resultInfo);
            const flag = profiles[res.playerId] ? (
              <Flag region={profiles[res.playerId].region} />
            ) : null;
            return (
              <ResultBlock
                res={res}
                chart={chart}
                leftProfile={leftProfile}
                rightProfile={rightProfile}
                placeDifference={placeDifference}
                flag={flag}
              />
            );
          })}
        </div>
      </div>
    );
  }
);
