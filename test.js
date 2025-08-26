// import ollama from 'ollama'

// // Define the API endpoint and your request payload
const apiEndpoint = 'http://192.168.50.101:11434/api/generate'; // Replace with actual endpoint

// // const response = await ollama.generate(apiEndpoint, {
// //     model: "gemma3:custom",
// //     prompt: "香港北部都會區最新消息?",
// // });
// // // console.log('Response:', response.data);

// // for await (const chunk of response){
// //     process.stdout.write(chunk.response)
// // }

// async function callOllamaAPI(){
//     const response = await fetch(apiEndpoint, {
//         method: 'POST',
//         header: {
//             'Content-Type' : 'application/json'
//         },
//         body: JSON.stringify({
//             model: "gemma3:custom",
//             prompt: "香港北部都會區最新消息?",
//             stream: true
//         })
//     })

//     const reader = response.body.getReader();
//     const decoder = new TextDecoder();

//     while(true){
//         const{done, value} = await reader.read();
//         if(done) break;
//         const responseData = JSON.parse(decoder.decode(value, {stream:true})).response;
//         console.log(responseData);
//     }
// }

// // Execute the function
// callOllamaAPI();

import { Ollama } from 'ollama'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

// Configuration for API calls
const CONFIG = {
  host: 'https://f81de3a18b1e.ngrok-free.app',
  model: 'gemma3:custom2',
  timeout: 30000, // 30 seconds
  retries: 3
}

const ollama = new Ollama({ host: CONFIG.host })
const rl = readline.createInterface({ input, output })

// API call wrapper with error handling and retries
async function makeAPICall(messages, options = {}) {
  const startTime = performance.now()
  
  const requestOptions = {
    model: options.model || CONFIG.model,
    messages: messages,
    stream: options.stream !== false, // Default to streaming
    ...options
  }

  for (let attempt = 1; attempt <= CONFIG.retries; attempt++) {
    try {
      console.log(`\n🔄 Making API call (attempt ${attempt}/${CONFIG.retries})...`)
      
      const response = await ollama.chat(requestOptions)
      const endTime = performance.now()
      const responseTime = Math.round(endTime - startTime)
      
      if (requestOptions.stream) {
        let fullResponse = ''
        for await (const part of response) {
          const content = part.message.content
          process.stdout.write(content)
          fullResponse += content
        }
        console.log(`\n⏱️ Response completed in ${responseTime}ms`)
        return { success: true, response: fullResponse, streaming: true, responseTime }
      } else {
        console.log(`\n⏱️ Response completed in ${responseTime}ms`)
        return { success: true, response: response.message.content, streaming: false, responseTime }
      }
    } catch (error) {
      const endTime = performance.now()
      const responseTime = Math.round(endTime - startTime)
      console.error(`\n❌ API call failed (attempt ${attempt}) after ${responseTime}ms: ${error.message}`)
      
      if (attempt === CONFIG.retries) {
        return { success: false, error: error.message, responseTime }
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
}

// Test API connectivity
async function testAPIConnection() {
  try {
    console.log('🔍 Testing API connection...')
    const testResponse = await ollama.list()
    console.log('✅ API connection successful')
    console.log('📋 Available models:', testResponse.models.map(m => m.name).join(', '))
    return true
  } catch (error) {
    console.error('❌ API connection failed:', error.message)
    return false
  }
}

// Interactive chat mode
async function interactiveMode() {
  console.log('\n🤖 Entering interactive chat mode...')
  console.log('Commands:')
  console.log('  - "exit" to quit')
  console.log('  - "config" to view current configuration')
  console.log('  - "test" to test API connection')
  console.log('  - "models" to list available models')
  console.log('  - "switch <model>" to change model\n')
  
  while (true) {
    const userInput = await rl.question('💬 Your question (or command): ')
    
    if (userInput.toLowerCase() === 'exit') {
      console.log('👋 Exiting...')
      break
    }
    
    if (userInput.toLowerCase() === 'config') {
      console.log('⚙️ Current configuration:')
      console.log(JSON.stringify(CONFIG, null, 2))
      continue
    }
    
    if (userInput.toLowerCase() === 'test') {
      await testAPIConnection()
      continue
    }
    
    if (userInput.toLowerCase() === 'models') {
      try {
        const response = await ollama.list()
        console.log('📋 Available models:')
        response.models.forEach(model => {
          console.log(`  - ${model.name} (${model.size} bytes)`)  
        })
      } catch (error) {
        console.error('❌ Failed to list models:', error.message)
      }
      continue
    }
    
    if (userInput.toLowerCase().startsWith('switch ')) {
      const newModel = userInput.slice(7).trim()
      CONFIG.model = newModel
      console.log(`🔄 Switched to model: ${newModel}`)
      continue
    }
    
    const message = { role: 'user', content: userInput }
    const systemPrompt = {
      role: "system", 
      content: "你是一位精通北部都會區的專家，對該地區的歷史、文化、地理、交通、旅遊景點、美食等方面具有深入的了解。你的回答應基於北部都會區的相關資訊，提供清晰、正面、具體且專業的內容，僅聚焦於推廣北部都會區的正面資訊，以吸引提問者深入了解並體驗該地區的獨特魅力。對於與北部都會區無關的問題，你應回答：「任何與北部都會區相關的問題，我都可以提供資訊。」確保回答始終保持專家語氣，避免表達不確定性和不要提供網址，並專注於提供實用、準確且積極的資訊。"
    }
    
    const result = await makeAPICall([systemPrompt, message])
    
    if (result.success) {
      console.log('\n✅ Response completed\n')
    } else {
      console.error(`\n❌ Failed after ${CONFIG.retries} attempts: ${result.error}\n`)
    }
  }
}

// Single API call function for programmatic use
async function singleAPICall(prompt, options = {}) {
  const message = { role: 'user', content: prompt }
  const messages = options.includeSystemPrompt ? [
    {
      role: "system", 
      content: "你是一位精通北部都會區的專家，對該地區的歷史、文化、地理、交通、旅遊景點、美食等方面具有深入的了解。你的回答應基於北部都會區的相關資訊，提供清晰、正面、具體且專業的內容，僅聚焦於推廣北部都會區的正面資訊，以吸引提問者深入了解並體驗該地區的獨特魅力。對於與北部都會區無關的問題，你應回答：「任何與北部都會區相關的問題，我都可以提供資訊。」確保回答始終保持專家語氣，避免表達不確定性和不要提供網址，並專注於提供實用、準確且積極的資訊。"
    },
    message
  ] : [message]
  
  return await makeAPICall(messages, options)
}

// HTTP Server for web interface
async function startHTTPServer(port) {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  
  const server = http.createServer(async (req, res) => {
    // Enhanced CORS configuration for GitHub Pages and ngrok
    const allowedOrigins = [
      'https://wetlandar.github.io',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'file://' // For local file access
    ]
    
    const origin = req.headers.origin
    if (allowedOrigins.includes(origin) || !origin) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*')
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', [
      'Content-Type',
      'Authorization', 
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Allow-Origin',
      'ngrok-skip-browser-warning' // Special header for ngrok
    ].join(', '))
    res.setHeader('Access-Control-Allow-Credentials', 'false')
    res.setHeader('Access-Control-Max-Age', '86400') // 24 hours
    
    // Add ngrok-specific headers to bypass warning page
    res.setHeader('ngrok-skip-browser-warning', 'true')
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Content-Length': '0'
      })
      res.end()
      return
    }
    
    if (req.method === 'GET' && req.url === '/') {
      // Serve HTML interface
      try {
        const htmlPath = path.join(__dirname, 'index.html')
        const html = fs.readFileSync(htmlPath, 'utf8')
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('HTML file not found. Please create index.html')
      }
    } else if (req.method === 'POST' && req.url === '/api/chat') {
      // Handle API requests
      let body = ''
      
      req.on('data', chunk => {
        body += chunk.toString()
      })
      
      req.on('end', async () => {
        try {
          const { question, stream = false } = JSON.parse(body)
          
          if (!question) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Question is required' }))
            return
          }
          
          if (stream) {
            // Server-Sent Events for streaming
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            })
            
            const message = { role: 'user', content: question }
            const systemPrompt = {
              role: "system", 
              content: "你是一位精通北部都會區的專家，對該地區的歷史、文化、地理、交通、旅遊景點、美食等方面具有深入的了解。你的回答應基於北部都會區的相關資訊，提供清晰、正面、具體且專業的內容，僅聚焦於推廣北部都會區的正面資訊，以吸引提問者深入了解並體驗該地區的獨特魅力。對於與北部都會區無關的問題，你應回答：「任何與北部都會區相關的問題，我都可以提供資訊。」確保回答始終保持專家語氣，避免表達不確定性和不要提供網址，並專注於提供實用、準確且積極的資訊。"
            }
            
            try {
              const response = await ollama.chat({
                model: CONFIG.model,
                messages: [systemPrompt, message],
                stream: true,
              })
              
              for await (const part of response) {
                const data = JSON.stringify({ content: part.message.content })
                res.write(`data: ${data}\n\n`)
              }
              
              res.write('data: {"done": true}\n\n')
              res.end()
            } catch (error) {
              const errorData = JSON.stringify({ error: error.message })
              res.write(`data: ${errorData}\n\n`)
              res.end()
            }
          } else {
            // Regular JSON response
            const startTime = performance.now()
            const result = await singleAPICall(question, { 
              includeSystemPrompt: true,
              stream: false 
            })
            const endTime = performance.now()
            const responseTime = Math.round(endTime - startTime)
            
            res.writeHead(200, { 'Content-Type': 'application/json' })
            
            if (result.success) {
              res.end(JSON.stringify({ 
                success: true, 
                response: result.response,
                responseTime: responseTime
              }))
            } else {
              res.end(JSON.stringify({ 
                success: false, 
                error: result.error,
                responseTime: responseTime
              }))
            }
          }
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Server error: ' + error.message }))
        }
      })
    } else if (req.method === 'GET' && req.url === '/api/status') {
      // Health check endpoint
      const isConnected = await testAPIConnection()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        status: isConnected ? 'connected' : 'disconnected',
        config: CONFIG 
      }))
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
    }
  })
  
  server.listen(port, () => {
    console.log(`🌐 HTTP Server started at http://localhost:${port}`)
    console.log(`📄 Web interface: http://localhost:${port}`)
    console.log(`🔗 API endpoint: http://localhost:${port}/api/chat`)
    console.log(`❤️ Health check: http://localhost:${port}/api/status`)
    console.log('\n🛑 Press Ctrl+C to stop the server\n')
  })
  
  // Test connection on startup
  setTimeout(async () => {
    await testAPIConnection()
  }, 1000)
}

async function main() {
  console.log('🚀 Ollama API Client Started')
  console.log('================================')
  console.log('Usage modes:')
  console.log('  node test.js                    - Interactive mode')
  console.log('  node test.js server [port]      - HTTP server mode (default port: 3000)')
  console.log('  node test.js "your question"    - Single API call')
  console.log('================================')
  
  // Test connection first
  const connectionOk = await testAPIConnection()
  if (!connectionOk) {
    console.log('\n⚠️ API connection failed. Please check your Ollama server.')
    console.log('Make sure Ollama is running at:', CONFIG.host)
    rl.close()
    return
  }
  
  // Check if running in server mode, interactive mode, or single call mode
  const args = process.argv.slice(2)
  
  if (args[0] === 'server') {
    // HTTP Server mode
    const port = args[1] || 3000
    await startHTTPServer(port)
  } else if (args.length > 0) {
    // Single API call mode
    const prompt = args.join(' ')
    console.log(`\n📝 Making single API call with prompt: "${prompt}"`)
    
    const result = await singleAPICall(prompt, { 
      includeSystemPrompt: true,
      stream: false 
    })
    
    if (result.success) {
      console.log('\n📄 Response:')
      console.log(result.response)
      if (result.responseTime) {
        console.log(`\n⏱️ Total response time: ${result.responseTime}ms`)
      }
    } else {
      console.error('\n❌ API call failed:', result.error)
      if (result.responseTime) {
        console.error(`⏱️ Failed after: ${result.responseTime}ms`)
      }
      process.exit(1)
    }
  } else {
    // Interactive mode
    await interactiveMode()
  }
  
  rl.close()
}


main().catch(console.error)
