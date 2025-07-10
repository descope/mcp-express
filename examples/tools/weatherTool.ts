import { registerAuthenticatedTool } from "@descope/mcp-express";
import { z } from "zod";

/**
 * Weather tool that demonstrates practical outbound token usage with a real external API
 */
export const weatherTool = registerAuthenticatedTool({
  name: "weather",
  description: "Get current weather information using external weather API",
  paramsSchema: {
    location: z.string().describe("City name or location to get weather for"),
    weatherAppId: z.string().describe("The outbound application ID for weather API access").optional(),
    units: z.enum(["metric", "imperial", "kelvin"]).describe("Temperature units").optional(),
  },
  requiredScopes: ["openid", "profile"], // Requires profile access
  execute: async ({ args, authInfo, getOutboundToken }: any) => {
    try {
      // Default weather app ID (this would be configured in Descope)
      const weatherAppId = args.weatherAppId || "weather-api-app";
      
      // Get outbound token for weather API access
      const weatherApiToken = await getOutboundToken(weatherAppId, ["weather:read"]);
      
      if (!weatherApiToken) {
        return {
          success: false,
          error: "Failed to obtain weather API token",
          location: args.location,
          appId: weatherAppId,
          timestamp: new Date().toISOString(),
        };
      }
      
      // Simulate weather API call
      // In a real implementation, you would call the actual weather API here
      const mockWeatherData = {
        location: args.location,
        temperature: Math.round(Math.random() * 30 + 5), // Random temp between 5-35°C
        conditions: ["sunny", "cloudy", "rainy", "snowy"][Math.floor(Math.random() * 4)],
        humidity: Math.round(Math.random() * 100),
        windSpeed: Math.round(Math.random() * 20),
        pressure: Math.round(Math.random() * 100 + 1000), // hPa
      };
      
      // Convert temperature based on units
      let temperature = mockWeatherData.temperature;
      let tempUnit = "°C";
      
      if (args.units === "imperial") {
        temperature = Math.round((temperature * 9/5) + 32);
        tempUnit = "°F";
      } else if (args.units === "kelvin") {
        temperature = Math.round(temperature + 273.15);
        tempUnit = "K";
      }
      
      return {
        success: true,
        weather: {
          location: args.location,
          temperature: `${temperature}${tempUnit}`,
          conditions: mockWeatherData.conditions,
          humidity: `${mockWeatherData.humidity}%`,
          windSpeed: `${mockWeatherData.windSpeed} km/h`,
          pressure: `${mockWeatherData.pressure} hPa`,
        },
        metadata: {
          appId: weatherAppId,
          tokenUsed: true,
          tokenLength: weatherApiToken.length,
          requestedBy: authInfo.clientId,
          units: args.units || "metric",
        },
        timestamp: new Date().toISOString(),
        note: "This is a mock weather response. In production, this would call a real weather API.",
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        location: args.location,
        timestamp: new Date().toISOString(),
      };
    }
  },
});