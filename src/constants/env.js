if (localStorage) {
  window.debugOn = () => {
    localStorage.setItem('debug', 1);
  };
  window.debugOff = () => {
    localStorage.removeItem('debug');
  };
}

export const DEBUG = localStorage && localStorage.getItem('debug');
