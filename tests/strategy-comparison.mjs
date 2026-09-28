import assert from 'node:assert/strict';
import { comparisonAvailability, filterStrategies, parseComparisonState, selectComparison, serializeComparisonState } from '../lib/strategy-comparison.mjs';

let assertions = 0;
function check(value, message) { assert.ok(value, message); assertions += 1; }
function equal(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions += 1; }

const products = [
  { id: 1, pairs: 'EURUSD,XAUUSD', ea_type: '趋势,多货币', price: 99, metrics: { maxDrawdownPercent: 12, reviewedAt: 1 }, verification: { level: 'report_verified' }, report: {}, currentVersion: {} },
  { id: 2, pairs: 'XAUUSD', ea_type: '网格', price: 0, metrics: { maxDrawdownPercent: 24, reviewedAt: 1 }, verification: { level: 'live_verified' }, report: {}, currentVersion: {} },
  { id: 3, pairs: 'GBPUSD', ea_type: '趋势', price: 300, metrics: null, verification: { level: 'unverified' }, report: null, currentVersion: null },
];

const parsed = parseComparisonState('?compare=2,1,2,invalid,3,9&pair=XAUUSD&type=%E8%B6%8B%E5%8A%BF&verification=report_verified&maxDrawdown=20&maxPrice=100');
equal(parsed.ids, [2, 1, 3, 9], 'comparison IDs are unique, valid and capped at four');
equal(parsed.pair, 'XAUUSD', 'pair restores from URL');
equal(parsed.maxDrawdown, 20, 'drawdown restores as a number');
equal(parseComparisonState('?verification=owner_claimed&maxDrawdown=-1').verification, '', 'unknown verification is rejected');
equal(parseComparisonState('?maxDrawdown=101').maxDrawdown, null, 'invalid drawdown is rejected');
const query = serializeComparisonState(parsed);
check(query.includes('compare=2%2C1%2C3%2C9'), 'selection serializes to URL');
equal(parseComparisonState(`?${query}`), parsed, 'URL state round trips');
equal(filterStrategies(products, { pair: 'XAUUSD', type: '', verification: '', maxDrawdown: 20, maxPrice: 100 }).map(item => item.id), [1], 'filters combine');
equal(filterStrategies(products, { pair: '', type: '', verification: 'platform_rerun', maxDrawdown: null, maxPrice: null }).map(item => item.id), [2], 'verification uses evidence rank');
equal(filterStrategies(products, { pair: '', type: '趋势', verification: '', maxDrawdown: null, maxPrice: null }).map(item => item.id), [1, 3], 'type matches exact CSV tags');
equal(selectComparison([1, 2], 2), [1], 'selected item toggles off');
equal(selectComparison([1, 2, 3, 4], 5), [1, 2, 3, 4], 'fifth item is rejected');
equal(selectComparison([1], 2), [1, 2], 'second item is added');
check(comparisonAvailability(products[0]), 'reviewed report and version are comparable');
check(!comparisonAvailability(products[2]), 'missing reviewed data is not comparable');
console.log(`Strategy comparison tests passed: ${assertions} assertions`);
