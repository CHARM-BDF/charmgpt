/**
 * LLM Response Cache Implementation
 * 
 * This file implements an in-memory cache for LLM responses to reduce API costs
 * and improve response times for repeated queries.
 */

import { LLMResponse } from './types';
import { generateCacheKey } from './utils';

/**
 * Options for the LLM cache
 */
export interface LLMCacheOptions {
  /** Time to live in seconds (default: 1 hour) */
  ttl?: number;
  /** Maximum number of cache entries (default: 1000) */
  maxKeys?: number;
}

/**
 * Simple in-memory LLM response cache
 */
export class LLMCache {
  /** Cache storage: key -> {value, expiry} */
  private cache: Map<string, { value: LLMResponse; expiry: number }>;
  /** Default TTL in milliseconds */
  private defaultTTL: number;
  /** Maximum cache size */
  private maxKeys: number;
  /** Stats for cache monitoring */
  private stats: { hits: number; misses: number; evictions: number };
  
  /**
   * Create a new LLM cache
   * @param options Cache configuration options
   */
  constructor(options: LLMCacheOptions = {}) {
    this.cache = new Map();
    this.defaultTTL = (options.ttl || 3600) * 1000; // Convert to milliseconds
    this.maxKeys = options.maxKeys || 1000;
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    
    // Start periodic cleanup
    this.startCleanupInterval();
    
    console.log(`LLMCache: Initialized with TTL ${this.defaultTTL}ms and max keys ${this.maxKeys}`);
  }
  
  /**
   * Store a response in the cache
   * @param prompt The prompt text
   * @param response The LLM response to cache
   * @param options Additional request options
   */
  set(prompt: string, response: LLMResponse, options: Record<string, any> = {}): void {
    // Enforce cache size limit
    if (this.cache.size >= this.maxKeys) {
      this.evictOldest();
    }
    
    const key = generateCacheKey(prompt, options);
    const ttl = options.cacheTTL !== undefined ? options.cacheTTL * 1000 : this.defaultTTL;
    const expiry = Date.now() + ttl;
    
    this.cache.set(key, { value: response, expiry });
  }
  
  /**
   * Get a cached response
   * @param prompt The prompt text
   * @param options Additional request options
   * @returns The cached response or undefined if not found/expired
   */
  get(prompt: string, options: Record<string, any> = {}): LLMResponse | undefined {
    const key = generateCacheKey(prompt, options);
    const entry = this.cache.get(key);
    
    // Check if entry exists and is not expired
    if (entry && entry.expiry > Date.now()) {
      this.stats.hits++;
      // Return a copy of the cached response with cached flag
      return {
        ...entry.value,
        cached: true
      };
    }
    
    // Delete expired entry if it exists
    if (entry) {
      this.cache.delete(key);
    }
    
    this.stats.misses++;
    return undefined;
  }
  
  /**
   * Check if a response is cached
   * @param prompt The prompt text
   * @param options Additional request options
   * @returns Whether a valid cache entry exists
   */
  has(prompt: string, options: Record<string, any> = {}): boolean {
    const key = generateCacheKey(prompt, options);
    const entry = this.cache.get(key);
    
    return !!(entry && entry.expiry > Date.now());
  }
  
  /**
   * Delete a specific cache entry or clear the entire cache
   * @param prompt Optional prompt to delete (if omitted, clears all)
   * @param options Additional request options
   */
  clear(prompt?: string, options?: Record<string, any>): void {
    if (typeof prompt === 'string' && options) {
      const key = generateCacheKey(prompt, options);
      this.cache.delete(key);
    } else {
      this.cache.clear();
      console.log('LLMCache: Cache cleared');
    }
  }
  
  /**
   * Start a periodic cleanup interval to remove expired entries
   */
  private startCleanupInterval(): void {
    // Run cleanup every minute
    setInterval(() => {
      this.cleanupExpired();
    }, 60000);
  }
  
  /**
   * Remove all expired entries from the cache
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry <= now) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`LLMCache: Removed ${removedCount} expired entries`);
    }
  }
  
  /**
   * Evict the oldest cache entry (LRU approach)
   */
  private evictOldest(): void {
    // For this simple implementation, just remove the first entry
    // In a more complex implementation, we'd track access times
    if (this.cache.size > 0) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.stats.evictions++;
      
      console.log('LLMCache: Cache full, evicted oldest entry');
    }
  }
  
  /**
   * Get cache statistics
   * @returns Object with cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxKeys,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions
    };
  }
} 