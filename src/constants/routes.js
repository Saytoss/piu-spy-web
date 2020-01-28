export const routes = {
  leaderboard: {
    path: `/leaderboard`,
  },
  songs: {
    path: `/songs`,
  },
  ranking: {
    path: `/ranking`,
    faq: {
      path: '/ranking/faq',
    },
  },
  profile: {
    path: `/profiles/:id`,
    getPath: params => `/profiles/${params.id}`,
  },
};
