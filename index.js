const { fork } = require("child_process");

module.exports = ({ limit = 1 } = {}) => {
  let regexWorker = null;
  let isworking = false;
  const regexQueue = [];
  process.on("exit", cleanup);
  return {
    test(regex, flags, string) {
      return new Promise((resolve, reject) => {
        if (!regexWorker) {
          regexWorker = createRegexWorker();
        }
        regexQueue.push({
          regex,
          flags,
          string,
          resolve,
          reject,
        });
        if (!isworking) {
          matchEachRegexViaWorker();
        }
        function createRegexWorker() {
          const regexWorker = fork(`${__dirname}/regexMatchThread.js`, {
            stdio: "ignore",
          });
          regexWorker.unref();
          regexWorker.channel.unref();
          return regexWorker;
        }
        function matchEachRegexViaWorker() {
          let isSettled = false;
          if (!regexQueue.length) {
            return;
          }
          isworking = true;
          const { regex, string, resolve, reject } = regexQueue.shift();
          regexWorker.once("message", receive);
          const timeout = setTimeout(function () {
            if (!isSettled) {
              regexWorker.kill();
              regexWorker = createRegexWorker();
              const error = new Error(
                `regex takes more than ${limit} seconds to evaluate.`
              );
              error.name = "timeout";
              reject(error);
              isSettled = true;
              isworking = false;
              matchEachRegexViaWorker();
            }
          }, limit * 1000);
          regexWorker.send({
            regex,
            flags,
            string,
          });
          function receive(message) {
            clearTimeout(timeout);
            if (!isSettled) {
              isSettled = true;
              isworking = false;
              resolve(message.result);
              matchEachRegexViaWorker();
            }
          }
        }
      });
    },
  };
  function cleanup() {
    if (regexWorker) {
      regexWorker.kill();
    }
  }
};
