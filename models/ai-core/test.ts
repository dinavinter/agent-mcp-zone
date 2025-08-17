#!/usr/bin/env -S deno run --allow-net --allow-env

// Test script for AI Core Proxy
const BASE_URL = "http://localhost:3002";

async function testHealth() {
  console.log("🔍 Testing health endpoint...");
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    console.log("✅ Health check:", data);
  } catch (error) {
    console.error("❌ Health check failed:", error);
  }
}

async function testModels() {
  console.log("\n🔍 Testing models endpoint...");
  try {
    const response = await fetch(`${BASE_URL}/models`);
    const data = await response.json();
    console.log("✅ Models:", data);
  } catch (error) {
    console.error("❌ Models endpoint failed:", error);
  }
}

async function testChatCompletion() {
  console.log("\n🔍 Testing chat completion...");
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Hello! Please respond with a short greeting." }
        ],
        max_tokens: 100,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.text();
      console.log("✅ Chat completion response:", data);
    } else {
      const error = await response.text();
      console.error("❌ Chat completion failed:", error);
    }
  } catch (error) {
    console.error("❌ Chat completion request failed:", error);
  }
}

async function main() {
  console.log("🚀 Starting AI Core Proxy tests...\n");
  
  await testHealth();
  await testModels();
  await testChatCompletion();
  
  console.log("\n✨ Tests completed!");
}

if (import.meta.main) {
  main();
}
