import { renderPrompt, PROMPT_VERSION } from '../src/prompts';
import type { BobInput } from '../src/types';

describe('Bob Prompts', () => {
  const sampleInput: BobInput = {
    nodeId: 'function_declaration[0]/block_statement[0]/return_statement[0]',
    nodeType: 'return_statement',
    changeType: 'UPDATE',
    riskLevel: 'HIGH',
    signals: ['return_value_changed', 'control_flow_condition_changed'],
    enclosingContext: 'calculateDiscount',
    textBefore: 'return price > 0 ? price * (1 - rate) : 0;',
    textAfter: 'return price * (1 - rate);',
  };

  test('renders v1/explain prompt correctly', () => {
    const rendered = renderPrompt('v1/explain', sampleInput);
    expect(rendered.promptVersion).toBe(`${PROMPT_VERSION}/explain`);
    expect(rendered.messages.length).toBe(2);
    expect(rendered.messages[0].role).toBe('system');
    expect(rendered.messages[1].role).toBe('user');
    expect(rendered.messages[1].content).toContain('calculateDiscount');
    expect(rendered.messages[1].content).toContain('return price * (1 - rate);');
    expect(rendered.messages[1].content).toContain('return_value_changed');
  });

  test('renders v1/test_stub prompt correctly', () => {
    const rendered = renderPrompt('v1/test_stub', sampleInput);
    expect(rendered.promptVersion).toBe(`${PROMPT_VERSION}/test_stub`);
    expect(rendered.messages.length).toBe(2);
    expect(rendered.messages[1].content).toContain('HIGH');
    expect(rendered.messages[1].content).toContain('calculateDiscount');
  });

  test('renders v1/impact prompt correctly', () => {
    const rendered = renderPrompt('v1/impact', sampleInput);
    expect(rendered.promptVersion).toBe(`${PROMPT_VERSION}/impact`);
    expect(rendered.messages.length).toBe(2);
    expect(rendered.messages[1].content).toContain('interface-level changes');
  });
});
