import { tool } from 'ai';
import { GaxiosError } from 'gaxios';
import { google } from 'googleapis';
import { z } from 'zod';
import { FederatedConnectionError } from '@auth0/ai/interrupts';

import { getAccessToken, withGoogleConnection } from '../auth0-ai';

export const getGoogleTasksTool = withGoogleConnection(
  tool({
    description: `Get tasks from the user's Google Tasks`,
    parameters: z.object({
      maxResults: z.number().optional().describe('Maximum number of tasks to return. Default is 20.'),
      showCompleted: z.boolean().optional().describe('Whether to show completed tasks. Default is true.'),
      showHidden: z.boolean().optional().describe('Whether to show hidden tasks. Default is false.'),
    }),
    execute: async ({ maxResults = 20, showCompleted = true, showHidden = false }) => {
      // Get the access token from Auth0 AI
      const accessToken = await getAccessToken();

      // Google SDK
      try {
        const tasksApi = google.tasks('v1');
        const auth = new google.auth.OAuth2();

        auth.setCredentials({
          access_token: accessToken,
        });

        const response = await tasksApi.tasks.list({
          auth,
          tasklist: '@default',
          maxResults,
          showCompleted,
          showHidden,
        });

        const tasks = response.data.items || [];

        return {
          tasksCount: tasks.length,
          tasks: tasks.map((task) => ({
            id: task.id,
            title: task.title || 'No title',
            notes: task.notes,
            due: task.due,
            status: task.status,
            completed: task.completed,
          })),
        };
      } catch (error) {
        if (error instanceof GaxiosError && error.response?.status === 401) {
          throw new FederatedConnectionError(`Authorization required to access the Federated Connection`);
        }

        throw error;
      }
    },
  }),
);

export const createGoogleTasksTool = withGoogleConnection(
  tool({
    description: `Create a new task in the user's Google Tasks`,
    parameters: z.object({
      title: z.string().describe('The title of the task.'),
      notes: z.string().optional().describe('The notes for the task.'),
      due: z.coerce
        .date()
        .optional()
        .describe('The due date for the task in ISO 8601 format (e.g., "2023-10-26"). Time information will be ignored.'),
    }),
    execute: async ({ title, notes, due }) => {
      // Get the access token from Auth0 AI
      const accessToken = await getAccessToken();

      // Google SDK
      try {
        const tasksApi = google.tasks('v1');
        const auth = new google.auth.OAuth2();

        auth.setCredentials({
          access_token: accessToken,
        });

        const requestBody = {
          title,
          notes,
          due: due
            ? new Date(due).toISOString()
            : undefined,
        };

        console.log('Creating Google Task with due date:', { due, processedDue: requestBody.due });

        const response = await tasksApi.tasks.insert({
          auth,
          tasklist: '@default',
          requestBody,
        });

        console.log('Google Task created successfully:', response.data);

        return response.data;
      } catch (error) {
        if (error instanceof GaxiosError) {
          console.error('Google API Error:', error.response?.data);
        } else {
          console.error('An unexpected error occurred:', error);
        }
        if (error instanceof GaxiosError && error.response?.status === 401) {
          throw new FederatedConnectionError(`Authorization required to access the Federated Connection`);
        }
        throw error;
      }
    },
  }),
);