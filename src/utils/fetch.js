import _ from 'lodash/fp';
import cookies from 'browser-cookies';

export const fetchJson = ({ url }) => request({ url, method: 'get' });
export const postJson = ({ url, body }) =>
  request({
    url,
    method: 'post',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
  });

const defaultHeaders = {};

export const request = async ({ url, method, body, headers }) => {
  try {
    const session = cookies.get('session');
    if (session) {
      defaultHeaders['Session'] = session;
    }
    const response = await fetch(url, {
      method,
      body,
      headers: { ...defaultHeaders, ...headers },
      credentials: 'include',
    });
    if (response.status >= 200 && response.status < 300) {
      const data = await response.json();
      return data;
    } else {
      const error = await response.json();
      if (_.isObject(error) && _.isString(error.error)) {
        throw new Error(error.error);
      } else if (_.isString(error)) {
        throw new Error(error);
      } else {
        throw new Error('HTTP Status ' + response.status);
      }
    }
  } catch (error) {
    console.error(error);
    return Promise.reject(error);
  }
};
