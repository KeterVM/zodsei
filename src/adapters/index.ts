import { HttpMethod, RequestContext, ResponseContext } from '../types';

/**
 * HTTP adapter interface
 */
export interface HttpAdapter {
  /**
   * Execute HTTP request
   */
  request(context: RequestContext): Promise<ResponseContext>;
  
  /**
   * Adapter name
   */
  readonly name: string;
}

/**
 * Adapter configuration options
 */
export interface AdapterConfig {
  timeout?: number;
  [key: string]: any;
}

/**
 * Supported adapter types
 */
export type AdapterType = 'fetch' | 'axios' | 'ky';

/**
 * Adapter factory function
 */
export async function createAdapter(
  type: AdapterType | HttpAdapter,
  config?: AdapterConfig
): Promise<HttpAdapter> {
  // If an adapter instance is passed, return it directly
  if (typeof type === 'object' && 'request' in type) {
    return type;
  }

  // Create adapter based on type
  switch (type) {
    case 'fetch': {
      const { FetchAdapter } = await import('./fetch');
      return new FetchAdapter(config);
    }
    
    case 'axios': {
      const { AxiosAdapter } = await import('./axios');
      return new AxiosAdapter(config);
    }
    
    case 'ky': {
      const { KyAdapter } = await import('./ky');
      return new KyAdapter(config);
    }
    
    default:
      throw new Error(`Unsupported adapter type: ${type}`);
  }
}

/**
 * Check if adapter is available
 */
export async function isAdapterAvailable(type: AdapterType): Promise<boolean> {
  try {
    switch (type) {
      case 'fetch':
        return typeof fetch !== 'undefined';
      
      case 'axios':
        await import('axios');
        return true;
      
      case 'ky':
        await import('ky');
        return true;
      
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Get default adapter
 */
export async function getDefaultAdapter(config?: AdapterConfig): Promise<HttpAdapter> {
  // Prefer fetch (built-in)
  if (await isAdapterAvailable('fetch')) {
    return createAdapter('fetch', config);
  }
  
  // Try axios next
  if (await isAdapterAvailable('axios')) {
    return createAdapter('axios', config);
  }
  
  // Finally try ky
  if (await isAdapterAvailable('ky')) {
    return createAdapter('ky', config);
  }
  
  throw new Error('No HTTP adapter available. Please install axios or ky, or ensure fetch is available.');
}
