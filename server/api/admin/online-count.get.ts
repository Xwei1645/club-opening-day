import { defineEventHandler } from 'h3';
import { sseManager } from '../../utils/sse';
import { prisma } from '../../utils/prisma';

export default defineEventHandler(async () => {
  const winnerConfirmCount = await prisma.participant.count({
    where: {
      drawResult: "WIN",
      hasJoinedGroup: true,
    },
  });

  return {
    count: sseManager.listenerCount('verify'),
    winnerConfirmCount,
  };
});
