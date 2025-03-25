
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { v4 as uuidv4 } from 'uuid';

// Create a stable fingerprint promise that can be reused
const fpPromise = FingerprintJS.load();

// Cache for the fingerprint value
let cachedFingerprint: string | null = null;

/**
 * Enhanced fingerprinting with more consistent results across sessions
 * Returns a stable device identifier using fingerprinting or fallback methods
 */
export const getDeviceId = async (): Promise<string> => {
  try {
    // If we already have a cached fingerprint, return it
    if (cachedFingerprint) {
      console.log('Using cached fingerprint:', cachedFingerprint);
      return cachedFingerprint;
    }
    
    // Try to get from sessionStorage first (more persistent in some incognito modes)
    const sessionFingerprint = sessionStorage.getItem('device_fingerprint');
    if (sessionFingerprint) {
      console.log('Using sessionStorage fingerprint:', sessionFingerprint);
      cachedFingerprint = sessionFingerprint;
      return sessionFingerprint;
    }
    
    // Try localStorage as backup
    const localFingerprint = localStorage.getItem('device_id');
    if (localFingerprint) {
      console.log('Using localStorage fingerprint:', localFingerprint);
      // Also store in sessionStorage for redundancy
      try {
        sessionStorage.setItem('device_fingerprint', localFingerprint);
      } catch (e) {
        console.error('Failed to store in sessionStorage:', e);
      }
      cachedFingerprint = localFingerprint;
      return localFingerprint;
    }
    
    console.log('Generating new fingerprint...');
    
    // Get fingerprint components with default options
    const fp = await fpPromise;
    const result = await fp.get();
    
    // Get the visitorId which is designed to be stable
    let deviceId = result.visitorId;
    
    console.log('Generated new fingerprint:', deviceId);
    
    // Store the fingerprint in multiple places for redundancy
    try {
      localStorage.setItem('device_id', deviceId);
      sessionStorage.setItem('device_fingerprint', deviceId);
      
      // Cache for this session
      cachedFingerprint = deviceId;
    } catch (e) {
      console.error('Failed to store fingerprint:', e);
    }
    
    return deviceId;
  } catch (error) {
    console.error('Error generating fingerprint:', error);
    // Fallback to UUID if fingerprinting fails
    const fallbackId = uuidv4();
    try {
      localStorage.setItem('device_id', fallbackId);
      sessionStorage.setItem('device_fingerprint', fallbackId);
    } catch (e) {
      console.error('Failed to store fallback ID:', e);
    }
    return fallbackId;
  }
};
