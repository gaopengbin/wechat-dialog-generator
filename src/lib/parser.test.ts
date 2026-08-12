import assert from 'node:assert/strict';
import test from 'node:test';
import { parseChatRecord } from './parser';

test('keeps explicit self aliases separate from other participants', () => {
  const result = parseChatRecord(`**【8月12日 上午10:20】**
**我**：周末有空吗
**小林**：有空
**我**：[语音]4`);

  assert.deepEqual(result.users.map((user) => user.name), ['我', '小林']);
  const self = result.users[0];
  const other = result.users[1];
  assert.equal(result.messages[1].senderId, self.id);
  assert.equal(result.messages[2].senderId, other.id);
  assert.equal(result.messages[3].senderId, self.id);
});

test('preserves first-sender-as-self behavior without an explicit alias', () => {
  const result = parseChatRecord(`**张三**：你好
**李四**：你好`);

  assert.deepEqual(result.users.map((user) => user.name), ['张三', '李四']);
  assert.equal(result.messages[0].senderId, result.users[0].id);
  assert.equal(result.messages[1].senderId, result.users[1].id);
});

test('parses optional voice transcription without changing plain voice messages', () => {
  const result = parseChatRecord(`**我**：[语音]5
**小林**：[语音]50:我一会儿找一下他那个平台`);

  assert.equal(result.messages[0].params.duration, 5);
  assert.equal(result.messages[0].params.transcript, undefined);
  assert.equal(result.messages[1].params.duration, 50);
  assert.equal(result.messages[1].params.transcript, '我一会儿找一下他那个平台');
});
