import React from 'react';

export const gradeValue = {
  F: 0.1,
  D: 0.2,
  'D+': 0.3,
  C: 0.3,
  'C+': 0.5,
  B: 0.5,
  'B+': 0.8,
  A: 0.8,
  'A+': 1,
  S: 1.1,
  SS: 1.2,
  SSS: 1.2,
};

export const getExp = (result, chart) => {
  if (!result.isBestGradeOnChart) {
    return 0;
  }
  if (chart.chartType === 'COOP') {
    return (chart.chartLevel * 1000 * (gradeValue[result.grade] || 0.8)) / 8;
  }
  const exp = (chart.chartLevel ** 2.31 * (gradeValue[result.grade] || 0.8)) / 9;
  return exp;
};

export const getRankImg = rank => (
  <img
    className={rank.color}
    src={`${process.env.PUBLIC_URL}/ranks/${rank.iconName}`}
    alt={rank.threshold}
  />
);

export const ranks = [
  {
    threshold: 0,
    iconName: '0.png',
    color: 'bronze',
  },
  {
    threshold: 1000,
    iconName: '1.png',
    color: 'bronze',
  },
  {
    threshold: 2000,
    iconName: '2.png',
    color: 'bronze',
  },
  {
    threshold: 3000,
    iconName: '3.png',
    color: 'bronze',
  },
  {
    threshold: 4000,
    iconName: '4.png',
    color: 'bronze',
  },
  {
    threshold: 5000,
    iconName: '5.png',
    color: 'bronze',
  },
  {
    threshold: 6250,
    iconName: '6.png',
    color: 'bronze',
  },
  {
    threshold: 7500,
    iconName: '7.png',
    color: 'bronze',
  },
  {
    threshold: 8750,
    iconName: '8.png',
    color: 'bronze',
  },
  {
    threshold: 10000,
    iconName: '9.png',
    color: 'silver',
  },
  {
    threshold: 12000,
    iconName: '10.png',
    color: 'silver',
  },
  {
    threshold: 14000,
    iconName: '11.png',
    color: 'silver',
  },
  {
    threshold: 16000,
    iconName: '12.png',
    color: 'silver',
  },
  {
    threshold: 18000,
    iconName: '13.png',
    color: 'silver',
  },
  {
    threshold: 22000,
    iconName: '14.png',
    color: 'silver',
  },
  {
    threshold: 26000,
    iconName: '15.png',
    color: 'silver',
  },
  {
    threshold: 30000,
    iconName: '16.png',
    color: 'silver',
  },
  {
    threshold: 35000,
    iconName: '17.png',
    color: 'silver',
  },
  {
    threshold: 40000,
    iconName: '18.png',
    color: 'gold',
  },
  {
    threshold: 50000,
    iconName: '19.png',
    color: 'gold',
  },
  {
    threshold: 60000,
    iconName: '20.png',
    color: 'gold',
  },
  {
    threshold: 70000,
    iconName: '21.png',
    color: 'gold',
  },
  {
    threshold: 80000,
    iconName: '22.png',
    color: 'gold',
  },
  {
    threshold: 100000,
    iconName: '23.png',
    color: 'gold',
  },
  {
    threshold: 120000,
    iconName: '24.png',
    color: 'gold',
  },
  {
    threshold: 140000,
    iconName: '25.png',
    color: 'gold',
  },
  {
    threshold: 160000,
    iconName: '26.png',
    color: 'gold',
  },
];
