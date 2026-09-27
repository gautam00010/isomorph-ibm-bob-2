const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Run tests in this specific order so the heavy fixtures test runs last
    const order = ['hash.test.ts', 'parser.test.ts', 'differ.test.ts', 'classifier.test.ts', 'fixtures.test.ts'];
    return tests.sort((a, b) => {
      const aName = a.path.split('/').pop() || '';
      const bName = b.path.split('/').pop() || '';
      const aIdx = order.findIndex(n => aName.endsWith(n));
      const bIdx = order.findIndex(n => bName.endsWith(n));
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }
}

module.exports = CustomSequencer;
