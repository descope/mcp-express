import { defineTool } from "../../src/utils.js";
import { z } from "zod";

/**
 * Google Calendar write tool that demonstrates outbound token usage
 * for creating and updating calendar events
 */
export const calendarWriteTool = defineTool({
  name: "calendar_write",
  description:
    "Create or update events in Google Calendar for the authenticated user",
  input: {
    calendarId: z
      .string()
      .describe("Calendar ID (default: 'primary' for user's main calendar)")
      .optional()
      .default("primary"),
    summary: z.string().describe("Event title/summary").min(1),
    description: z.string().describe("Event description").optional(),
    startTime: z.string().describe("Event start time (ISO 8601 format)").min(1),
    endTime: z.string().describe("Event end time (ISO 8601 format)").min(1),
    location: z.string().describe("Event location").optional(),
    attendees: z
      .array(z.string().email())
      .describe("List of attendee email addresses")
      .optional(),
    eventId: z
      .string()
      .describe(
        "Event ID for updating existing events (leave empty for new events)"
      )
      .optional(),
  },
  scopes: ["openid", "calendar:write"],
  handler: async (args, extra) => {
    const {
      calendarId,
      summary,
      description,
      startTime,
      endTime,
      location,
      attendees,
      eventId,
    } = args;

    // Get outbound token for Google Calendar API
    const outboundToken = await extra.getOutboundToken("google-calendar", [
      "https://www.googleapis.com/auth/calendar",
    ]);

    if (!outboundToken) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Failed to obtain Google Calendar access token",
                message:
                  "Please ensure the user has granted calendar write permissions",
                authenticatedUser: extra.authInfo.clientId,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    try {
      // Prepare event data
      const eventData: Record<string, unknown> = {
        summary,
        description,
        start: {
          dateTime: startTime,
          timeZone: "UTC",
        },
        end: {
          dateTime: endTime,
          timeZone: "UTC",
        },
      };

      if (location) {
        eventData.location = location;
      }

      if (attendees && attendees.length > 0) {
        eventData.attendees = attendees.map((email) => ({ email }));
      }

      // Determine if this is a create or update operation
      const isUpdate = !!eventId;
      const url = isUpdate
        ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`
        : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

      // Make request to Google Calendar API
      const response = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${outboundToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: `Failed to ${isUpdate ? "update" : "create"} calendar event`,
                  status: response.status,
                  statusText: response.statusText,
                  details: errorData,
                  authenticatedUser: extra.authInfo.clientId,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const event = await response.json();

      // Format the response
      const result = {
        action: isUpdate ? "updated" : "created",
        eventId: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location,
        attendees: event.attendees?.map((a: { email: string }) => a.email),
        organizer: event.organizer?.email,
        htmlLink: event.htmlLink,
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
                error: "Failed to write calendar event",
                message:
                  error instanceof Error ? error.message : "Unknown error",
                authenticatedUser: extra.authInfo.clientId,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  },
});
