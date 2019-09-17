export const routes = {
  leaderboard: {
    path: `/leaderboard`,
  },
  ranking: {
    path: `/ranking`,
    faq: {
      path: '/ranking/faq',
    },
  },
  profile: {
    path: `/profiles/:name`,
    getPath: params => `/profiles/${params.name}`,
  },
};
