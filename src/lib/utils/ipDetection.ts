
/**
 * Gets the user's IP address using an external service
 * @returns Promise resolving to the user's IP address or 'unknown-ip' if it fails
 */
export const getUserIpAddress = async (): Promise<string> => {
  try {
    // Use a reliable external service that returns JSON
    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) {
      throw new Error('Failed to fetch IP address');
    }
    
    const data = await response.json();
    console.log('Retrieved IP address:', data.ip);
    return data.ip;
  } catch (error) {
    console.error('Error getting IP address:', error);
    // Return a placeholder if we can't get the IP
    // This will still allow voting, but may not enforce the limit correctly
    return 'unknown-ip';
  }
};
