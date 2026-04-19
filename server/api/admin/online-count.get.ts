import { defineEventHandler } from 'h3';
import { sseManager } from '../../utils/sse';

export default defineEventHandler(() => {
  return {
    count: sseManager.listenerCount('verify')
  };
});
