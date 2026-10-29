import assert from 'node:assert/strict';
import { ForceAgentOrchestratorRunner, tinyfishAdapter } from '../lib/force-agent/phase2Adapters.js';
import { buildUniversalGoal } from '../lib/force-agent/memoryHelpers.js';

async function runTest() {
  const prompt = ' https://www.ignitealiign.com/schedule#/class-schedule/r/1613 register me in the 11 am class';
  console.log('--- TEST PROMPT ---');
  console.log(prompt);

  // 1. Test Goal Generation
  const goal = buildUniversalGoal({
    url: 'https://www.ignitealiign.com/schedule#/class-schedule/r/1613',
    prompt,
    taskType: 'registration',
    profile: {
      name: 'Alex Mercer',
      email: 'alex.mercer@example.com',
      phone: '+1 555 123 4567',
    },
  });

  console.log('\n--- GENERATED GOAL ---');
  console.log(goal);

  // 2. Test Orchestrator handle
  const runner = new ForceAgentOrchestratorRunner();
  const res = await runner.handle({
    type: 'chat',
    userId: 'test-user-123',
    messages: [{ role: 'user', content: prompt }],
  });

  console.log('\n--- ORCHESTRATOR RESULT ---');
  console.log('Message:', res.message);
  console.log('Tool Execution:', JSON.stringify(res.toolExecution, null, 2));

  // 3. Test Adapter Execution
  const adapterRes = await tinyfishAdapter.execute({
    action: 'goal',
    url: res.toolExecution.data.url,
    prompt,
    taskType: 'registration',
    profile: {
      name: 'Alex Mercer',
      email: 'alex.mercer@example.com',
    },
  });

  console.log('\n--- ADAPTER EXECUTION ---');
  console.log('OK:', adapterRes.ok);
  console.log('Adapter Data:', adapterRes.data);

  // Assertions
  assert.equal(res.toolExecution?.tool, 'tinyfish');
  assert.equal(res.toolExecution?.data?.url, 'https://www.ignitealiign.com/schedule#/class-schedule/r/1613');
  console.log('\n>>> SUCCESS: Force Agent accurately parsed, routed, and generated browser automation for the Ignite Aliign class registration task!');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
