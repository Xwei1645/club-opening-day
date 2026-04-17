import { EventEmitter } from 'events';

class SSEManager extends EventEmitter {
  private static instance: SSEManager;
  
  private constructor() {
    super();
    this.setMaxListeners(1000);
  }

  public static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }

  public notifyVerify(ticketCode: string) {
    this.emit('verify', ticketCode);
  }
}

export const sseManager = SSEManager.getInstance();
