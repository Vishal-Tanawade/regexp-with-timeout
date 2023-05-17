const { fork } = require("child_process");

module.exports = ({ limit = 1 } = {}) => {
  let regexWorker = null;
  let isWorking = false;
  const regexQueue = [];
  process.on("exit", cleanup);
  return {
    test(regExp, flags, string) {
      return new Promise((resolve, reject) => {
        if (!regexWorker) {
          regexWorker = createRegexWorker();
        }
        regexQueue.push({
          regExp,
          flags,
          string,
          resolve,
          reject,
        });
        if (!isWorking) {
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
          isWorking = true;
          const { regExp, string, resolve, reject } = regexQueue.shift();
          regexWorker.once("message", receive);
          const timeout = setTimeout(function () {
            if (!isSettled) {
              regexWorker.kill();
              regexWorker = createRegexWorker();
              const error = new Error(
                `regExp takes more than ${limit} seconds to evaluate.`
              );
              error.name = "timeout";
              reject(error);
              isSettled = true;
              isWorking = false;
              matchEachRegexViaWorker();
            }
          }, limit * 1000);
          regexWorker.send({
            regExp,
            flags,
            string,
          });
          function receive(message) {
            clearTimeout(timeout);
            if (!isSettled) {
              isSettled = true;
              isWorking = false;
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
