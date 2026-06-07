import * as assert from 'assert';
import { buildDumpArgs } from '../lupaCli';

suite('Lupa CLI helpers', () => {
	test('buildDumpArgs includes dump target and stats', () => {
		const args = buildDumpArgs('Test/sample.rbxm');

		assert.ok(args.includes('dump'));
		assert.ok(args.includes('Test/sample.rbxm'));
		assert.ok(args.includes('--stats'));
		assert.ok(!args.includes('--format'));
	});
});
