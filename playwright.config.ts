import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
reporter: [
  ['list'],
  ['html', { open: 'never' }]
],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://outlook.live.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'sender',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'storage/sender.storageState.json',
      },
    },
    {
      name: 'receiver',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'storage/receiver.storageState.json',
      },
    },
  ],
});
