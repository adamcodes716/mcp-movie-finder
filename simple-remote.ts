#!/usr/bin/env bun

// Simple HTTP wrapper for the existing MCP server
// This allows mcp-remote to connect to our local server

import { spawn } from "child_process";
import { serve } from "bun";

const PORT = process.env.PORT || 8000;
const API_KEY = process.env.API_KEY || "jacvz78t";

// Start the local MCP server as a child process
const mcpProcess = spawn("bun", ["run", "index.ts"], {
  stdio: ["pipe", "pipe", "pipe"],
  cwd: process.cwd()
});

mcpProcess.stderr?.on("data", (data) => {
  console.error("MCP Server:", data.toString());
});

// HTTP server that proxies to the local MCP server
const server = serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "movie-rec-mcp-proxy" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // MCP endpoint
    if (url.pathname === "/mcp" && request.method === "POST") {
      // Check API key
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401 });
      }

      const token = authHeader.substring(7);
      if (token !== API_KEY) {
        return new Response("Invalid API key", { status: 403 });
      }

      try {
        // Get the JSON-RPC message from the request
        const message = await request.text();
        
        // Send to MCP server via stdin
        mcpProcess.stdin?.write(message + "\n");

        // Wait for response from MCP server
        return new Promise((resolve) => {
          const onData = (data: Buffer) => {
            const response = data.toString().trim();
            if (response) {
              mcpProcess.stdout?.off("data", onData);
              resolve(new Response(response, {
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                },
              }));
            }
          };
          mcpProcess.stdout?.on("data", onData);

          // Timeout after 30 seconds
          setTimeout(() => {
            mcpProcess.stdout?.off("data", onData);
            resolve(new Response(JSON.stringify({
              error: { code: -1, message: "Request timeout" }
            }), {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            }));
          }, 30000);
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: { code: -1, message: error instanceof Error ? error.message : "Unknown error" }
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Movie Recommendation MCP Proxy running on http://localhost:${PORT}`);
console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
console.log(`Use with mcp-remote: npx mcp-remote http://localhost:${PORT}/mcp --header "Authorization:Bearer ${API_KEY}"`);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down...");
  mcpProcess.kill();
  server.stop();
  process.exit(0);
});