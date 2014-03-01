// Just starting setting up testing for now; modularization will have to 
// be different in order to do *useful* tests.  But Journey of 1,000 miles,
// single step, all that...

// using assert passed to the test function that just logs failures
exports['test that logs all failures'] = function(assert) {
  assert.equal(1 + 1, 2, 'assert failure is logged')
}

if (module == require.main) require('test').run(exports)
