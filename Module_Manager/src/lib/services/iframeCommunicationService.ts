/**
 * Iframe Communication Service
 * Handles communication between parent modules and the coverage map iframe
 */

import { objectStateManager, type ModuleContext, type ObjectState } from './objectStateManager';

export interface IframeMessage {
  type: 'object-state-request' | 'object-state-response' | 'module-context-update' | 'object-action';
  data?: any;
  objectId?: string;
  action?: string;
}

export class IframeCommunicationService {
  private static instance: IframeCommunicationService;
  private iframe: HTMLIFrameElement | null = null;
  private moduleContext: ModuleContext = { module: 'coverage-map', userRole: 'admin' };
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  public static getInstance(): IframeCommunicationService {
    if (!IframeCommunicationService.instance) {
      IframeCommunicationService.instance = new IframeCommunicationService();
    }
    return IframeCommunicationService.instance;
  }

  /**
   * Initialize communication with the coverage map iframe
   */
  initialize(iframe: HTMLIFrameElement, context: ModuleContext): void {
    this.iframe = iframe;
    this.moduleContext = context;
    
    // Listen for messages from the iframe
    window.addEventListener('message', this.handleMessage.bind(this));
    
    // Send initial context to iframe
    this.sendMessage({
      type: 'module-context-update',
      data: context
    });
  }

  /**
   * Update module context
   */
  updateContext(context: ModuleContext): void {
    this.moduleContext = context;
    this.sendMessage({
      type: 'module-context-update',
      data: context
    });
  }

  /**
   * Request object state information
   */
  requestObjectState(objectId: string): Promise<ObjectState> {
    return new Promise((resolve) => {
      const handlerId = `object-state-${objectId}-${Date.now()}`;
      
      this.messageHandlers.set(handlerId, (data) => {
        this.messageHandlers.delete(handlerId);
        resolve(data);
      });

      this.sendMessage({
        type: 'object-state-request',
        objectId,
        data: { handlerId }
      });
    });
  }

  /**
   * Send action to iframe
   */
  sendAction(objectId: string, action: string, data?: any): void {
    this.sendMessage({
      type: 'object-action',
      objectId,
      action,
      data
    });
  }

  /**
   * Handle messages from iframe
   */
  private handleMessage(event: MessageEvent): void {
    if (!event.data || typeof event.data !== 'object') return;
    
    const message: IframeMessage = event.data;
    
    switch (message.type) {
      case 'object-state-response':
        if (message.data?.handlerId) {
          const handler = this.messageHandlers.get(message.data.handlerId);
          if (handler) {
            handler(message.data.state);
          }
        }
        break;
        
      case 'object-action':
        this.handleObjectAction(message);
        break;
    }
  }

  /**
   * Handle object actions from iframe
   */
  private handleObjectAction(message: IframeMessage): void {
    const { objectId, action, data } = message;
    if (!objectId || !action) return;
    
    // Get object state to check permissions
    this.requestObjectState(objectId).then((state) => {
      if (objectStateManager.isActionAllowed({ id: objectId }, action, this.moduleContext)) {
        // Action is allowed, proceed
        this.onObjectActionAllowed(objectId, action, data);
      } else {
        // Action is not allowed, show warning
        this.onObjectActionDenied(objectId, action, state);
      }
    });
  }

  /**
   * Called when an object action is allowed
   */
  private onObjectActionAllowed(objectId: string, action: string, data: any): void {
    console.log(`Action '${action}' allowed for object ${objectId}`);
    // Emit custom event for parent modules to handle
    window.dispatchEvent(new CustomEvent('iframe-object-action', {
      detail: { objectId, action, data, allowed: true }
    }));
  }

  /**
   * Called when an object action is denied
   */
  private onObjectActionDenied(objectId: string, action: string, state: ObjectState): void {
    console.warn(`Action '${action}' denied for object ${objectId}. State:`, state);
    
    // Show user-friendly message
    const message = this.getActionDeniedMessage(action, state);
    
    // Emit custom event for parent modules to handle
    window.dispatchEvent(new CustomEvent('iframe-object-action', {
      detail: { objectId, action, allowed: false, message, state }
    }));
  }

  /**
   * Get user-friendly message for denied actions
   */
  private getActionDeniedMessage(action: string, state: ObjectState): string {
    if (state.source === 'acs') {
      return `ACS-managed objects can only have GPS coordinates and customer data modified.`;
    }
    
    if (state.isReadOnly) {
      return `This object is read-only in the ${this.moduleContext.module} module.`;
    }
    
    if (state.status === 'deployed') {
      return `Deployed objects cannot be modified.`;
    }
    
    if (state.source === 'pci-optimized' || state.source === 'frequency-optimized') {
      return `This object is managed by optimization algorithms and cannot be manually moved or deleted.`;
    }
    
    return `Action '${action}' is not allowed for this object.`;
  }

  /**
   * Send message to iframe
   */
  private sendMessage(message: IframeMessage): void {
    if (!this.iframe?.contentWindow) return;
    
    try {
      this.iframe.contentWindow.postMessage(message, '*');
    } catch (error) {
      console.error('Failed to send message to iframe:', error);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    window.removeEventListener('message', this.handleMessage.bind(this));
    this.messageHandlers.clear();
    this.iframe = null;
  }
}

// Export singleton instance
export const iframeCommunicationService = IframeCommunicationService.getInstance();
