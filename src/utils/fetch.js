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
      throw Error('HTTP Status ' + response.status);
    }
  } catch (error) {
    console.error(error);
    return Promise.reject(error);
  }
};
