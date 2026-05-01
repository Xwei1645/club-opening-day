import { defineEventHandler, createEventStream, getQuery } from 'h3';
import { sseManager } from '../../utils/sse';

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const ticketCode = query.ticketCode as string;

  if (!ticketCode) {
    return { error: 'Missing ticketCode' };
  }

  const eventStream = createEventStream(event);

  const heartbeat = setInterval(async () => {
    try {
      await eventStream.push(": heartbeat\n\n");
    } catch (e) {
      clearInterval(heartbeat);
      sseManager.off("verify", onVerify);
      await eventStream.close();
    }
  }, 15000);

  const onVerify = async (code: string, ticketNo?: number) => {
    if (code === ticketCode) {
      try {
        await eventStream.push({
          event: "verify-success",
          data: JSON.stringify({ 
            message: "欢迎来到浙江省温州中学",
            ticketNo 
          }),
        });
      } finally {
        clearInterval(heartbeat);
        sseManager.off("verify", onVerify);
        await eventStream.close();
      }
    }
  };

  sseManager.on("verify", onVerify);

  eventStream.onClosed(() => {
    clearInterval(heartbeat);
    sseManager.off("verify", onVerify);
  });

  return eventStream.send();
});
