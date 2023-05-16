process.on("message", ({ regExp, flags, string }) => {
  const newRegex = new RegExp(regExp, flags);
  process.send({
    result: newRegex.test(string),
  });
});
