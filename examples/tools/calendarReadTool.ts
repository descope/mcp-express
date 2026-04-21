import { defineTool } from "../../src/utils.js";
import { z } from "zod";

/**
 * Google Calendar read tool that demonstrates outbound token usage
 * for accessing external APIs with user context
 */
export const calendarReadTool = defineTool({
  name: "calendar_read",
  description: "Read events from Google Calendar for the authenticated user",
  input: {
    calendarId: z
      .string()
      .describe("Calendar ID (default: 'primary' for user's main calendar)")
      .optional()
      .default("primary"),
    timeMin: z
      .string()
      .describe("Start time for events (ISO 8601 format, default: now)")
      .optional(),
    timeMax: z
      .string()
      .describe(
        "End time for events (ISO 8601 format, default: 7 days from now)",
      )
      .optional(),
    maxResults: z
      .number()
      .describe("Maximum number of events to return (default: 10)")
      .optional()
      .default(10),
  },
  scopes: ["openid", "calendar:read"],
  handler: async (args, extra) => {
    const { calendarId, timeMin, timeMax, maxResults } = args;

    // Get outbound token for Google Calendar API
    const outboundToken = await extra.getOutboundToken(
      "google-calendar", // App ID configured in Descope
      ["https://www.googleapis.com/auth/calendar"],
    );

    if (!outboundToken) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Failed to obtain Google Calendar access token",
                message:
                  "Please ensure the user has granted calendar read permissions",
                authenticatedUser: extra.authInfo.clientId,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    try {
      // Set default time range if not provided
      const now = new Date();
      const startTime = timeMin ? new Date(timeMin) : now;
      const endTime = timeMax
        ? new Date(timeMax)
        : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      // Build Google Calendar API URL
      const params = new URLSearchParams({
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        maxResults: maxResults.toString(),
        singleEvents: "true",
        orderBy: "startTime",
      });

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

      // Make request to Google Calendar API
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${outboundToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "Failed to fetch calendar events",
                  status: response.status,
                  statusText: response.statusText,
                  details: errorData,
                  authenticatedUser: extra.authInfo.clientId,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const data = await response.json();

      // Format the response
      const events =
        data.items?.map(
          (event: {
            id: string;
            summary?: string;
            description?: string;
            start?: { dateTime?: string; date?: string };
            end?: { dateTime?: string; date?: string };
            location?: string;
            attendees?: Array<{ email: string }>;
            organizer?: { email: string };
          }) => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            location: event.location,
            attendees: event.attendees?.map((a) => a.email),
            organizer: event.organizer?.email,
          }),
        ) || [];

      const result = {
        calendarId,
        timeRange: {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
        },
        totalEvents: events.length,
        events,
        authenticatedUser: extra.authInfo.clientId,
        timestamp: new Date().toISOString(),
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Failed to fetch calendar events",
                message:
                  error instanceof Error ? error.message : "Unknown error",
                authenticatedUser: extra.authInfo.clientId,
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
});
