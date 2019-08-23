import React, { Component } from "react";
import toBe from "prop-types";
import { connect } from "react-redux";
import { createSelector } from "reselect";
import ReactTable from "react-table";
import classNames from "classnames";
import matchSorter from "match-sorter";
import lodashFp from "lodash/fp";
import ReactTimeAgo from "react-time-ago";

import "react-table/react-table.css";
import "./rankings.scss";

import { fetchTopScores } from "reducers/top";

const _ = lodashFp.convert({ cap: false });

const columns = [
  {
    minWidth: 120,
    maxWidth: 250,
    Header: "song",
    filterable: true,
    filterMethod: (filter, rows) => {
      return matchSorter(rows, filter.value, { keys: ["track"] });
    },
    filterAll: true,
    accessor: "track"
  },
  {
    minWidth: 50,
    maxWidth: 50,
    filterable: true,
    filterMethod: (filter, rows) => {
      return matchSorter(rows, filter.value, { keys: ["track"] });
    },
    filterAll: true,
    accessor: "chart_label"
  }
  // {
  //   filterable: true,
  //   filterMethod: (filter, rows) => {
  //     return matchSorter(rows, filter.value, { keys: ["name"] });
  //   },
  //   filterAll: true,
  //   Cell: props => (
  //     <a href={`https://osu.ppy.sh/users/${props.original.name}`}>
  //       {props.original.name}
  //     </a>
  //   ),
  //   accessor: "name"
  // },
  // {
  //   maxWidth: 300,
  //   Cell: ({ original }) => (
  //     <span className="updated-at">
  //       <span>scores updated</span>
  //       <ReactTimeAgo
  //         timeStyle={{ units: ["second", "minute", "hour"] }}
  //         date={original.updateDate}
  //       />
  //     </span>
  //   ),
  //   accessor: "pp2"
  // },
  // {
  //   maxWidth: 170,
  //   Cell: ({ original }) => (
  //     <span>
  //       <span className="pp">{original.pp2}pp </span>
  //       <span className="pp-diff">
  //         {original.ppIncrement !== null ? `+${original.ppIncrement}` : ""}
  //       </span>
  //     </span>
  //   ),
  //   accessor: "pp2"
  // },
  // {
  //   maxWidth: 170,
  //   Cell: ({ original }) => {
  //     const totalChange = original.ppDiff;
  //     return (
  //       <span>
  //         <span
  //           className={classNames("pp-change", {
  //             positive: totalChange > 0,
  //             negative: totalChange < 0
  //           })}
  //         >
  //           {totalChange > 0 ? "+" : ""}
  //           {totalChange}pp
  //         </span>
  //       </span>
  //     );
  //   },
  //   accessor: "pp2"
  // },
  // {
  //   width: 110,
  //   Cell: ShowScoresCell,
  //   accessor: "scores"
  // }
];

const dataSelector = createSelector(
  state => state.top.data,
  _.flow([
    _.get("top"),
    _.values,
    _.orderBy(["track", "chart_label"], ["asc", "asc"])
  ])
);

const mapStateToProps = state => {
  const data = dataSelector(state);
  return {
    data,
    error: state.top.error,
    isLoading: state.top.isLoading
  };
};

const mapDispatchToProps = {
  fetchTopScores
};

class TopScores extends Component {
  static propTypes = {
    match: toBe.object,
    data: toBe.array,
    error: toBe.object,
    isLoading: toBe.bool.isRequired
  };

  componentDidMount() {
    const { isLoading } = this.props;
    if (!isLoading) {
      this.props.fetchTopScores();
    }
  }

  render() {
    const { isLoading, data, error } = this.props;
    return (
      <div className="rankings">
        <header></header>
        <div className="content">
          {isLoading && <div className="loading">loading...</div>}
          {error && error.message}
          <div className="top-list">
            <ReactTable
              data={data}
              columns={columns}
              showPageSizeOptions={false}
              defaultPageSize={20}
              sortable
              resizable={false}
              minRows={4}
              noDataText={isLoading ? "loading..." : "no data found"}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TopScores);
