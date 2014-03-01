assert = require('assert')

exports['test that stops execution on first failure'] = function() {
  assert.equal(2 + 2, 5, 'assert fails and test execution stop here')
  assert.equal(3 + 2, 5, 'will never pass this since test failed above')
}

if (module == require.main) require('test').run(exports)
