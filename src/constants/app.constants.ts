/**
 * Centralized app constants for Outlook Live.
 */

export const APP = {
  baseUrl: 'https://outlook.live.com',
  mailEntryPath: '/mail/0/',
  expectedMailUrlPrefix: 'https://outlook.live.com/mail/0/',

  storage: {
    sender: 'storage/sender.storageState.json',
    receiver: 'storage/receiver.storageState.json'
  }
} as const;
