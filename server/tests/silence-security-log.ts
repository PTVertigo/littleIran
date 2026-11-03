// logSecurity writes to console.info/warn on every login and refusal; keep that out of the test output.
// Tests that assert on the log spy on the console themselves and take over this mock.
beforeEach(() => {
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
