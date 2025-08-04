const Groq = require('groq-sdk');
const { pruneMessageHistory } = require('./messageUtils');

function validateApiKey(settings) {
    if (!settings.GROQ_API_KEY || settings.GROQ_API_KEY === "<replace me>") {
        throw new Error("API key not configured. Please add your GROQ API key in settings.");
    }
}

function determineModel(model, settings, modelContextSizes) {
    const modelToUse = model || settings.model || "llama-3.3-70b-versatile";
    const modelInfo = modelContextSizes[modelToUse] || modelContextSizes['default'] || { context: 8192, vision_supported: false };
    return { modelToUse, modelInfo };
}

function checkVisionSupport(messages, modelInfo, modelToUse) {
    const hasImages = messages.some(msg =>
        msg.role === 'user' &&
        Array.isArray(msg.content) &&
        msg.content.some(part => part.type === 'image_url')
    );

    if (hasImages && !modelInfo.vision_supported) {
        throw new Error(`The selected model (${modelToUse}) does not support image inputs. Please select a vision-capable model.`);
    }
}

function prepareTools(discoveredTools) {
    return (discoveredTools || []).map(tool => ({
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema || {}
        }
    }));
}

// Removes internal UI fields and ensures API-compatible message format
function cleanMessages(messages) {
    return messages.map(msg => {
        const cleanMsg = { ...msg };
        // Remove compound-beta and UI-specific fields before API call
        delete cleanMsg.reasoning;
        delete cleanMsg.isStreaming;
        delete cleanMsg.executed_tools;
        delete cleanMsg.liveReasoning;
        delete cleanMsg.liveExecutedTools;

        // Ensure user content is array format for vision support
        if (cleanMsg.role === 'user') {
            if (typeof cleanMsg.content === 'string') {
                cleanMsg.content = [{ type: 'text', text: cleanMsg.content }];
            } else if (!Array.isArray(cleanMsg.content)) {
                cleanMsg.content = [{ type: 'text', text: '' }];
            }
            cleanMsg.content = cleanMsg.content.map(part => ({ type: part.type || 'text', ...part }));
        }

        // Ensure assistant content is string format
        if (cleanMsg.role === 'assistant' && typeof cleanMsg.content !== 'string') {
            if (Array.isArray(cleanMsg.content)) {
                cleanMsg.content = cleanMsg.content.filter(p => p.type === 'text').map(p => p.text).join('');
            } else {
                try {
                    cleanMsg.content = JSON.stringify(cleanMsg.content);
                } catch { cleanMsg.content = '[Non-string content]'; }
            }
        }

        // Ensure tool content is stringified
        if (cleanMsg.role === 'tool' && typeof cleanMsg.content !== 'string') {
            try {
                cleanMsg.content = JSON.stringify(cleanMsg.content);
            } catch {
                cleanMsg.content = "[Error stringifying tool content]";
            }
        }
        return cleanMsg;
    });
}

function buildApiParams(prunedMessages, modelToUse, settings, tools) {
    let systemPrompt = "You are a helpful assistant capable of using tools. Use tools only when necessary and relevant to the user's request. Format responses using Markdown.";
    if (settings.customSystemPrompt && settings.customSystemPrompt.trim()) {
        systemPrompt += `\n\n${settings.customSystemPrompt.trim()}`;
    }

    return {
        messages: [{ role: "system", content: systemPrompt }, ...prunedMessages],
        model: modelToUse,
        temperature: settings.temperature ?? 0.7,
        top_p: settings.top_p ?? 0.95,
        ...(tools.length > 0 && { tools, tool_choice: "auto" }),
        stream: true
    };
}

// Processes individual stream chunks for compound-beta and regular models
function processStreamChunk(chunk, event, accumulatedData) {
    if (!chunk.choices?.[0]) return;

    const { delta } = chunk.choices[0];

    if (accumulatedData.isFirstChunk) {
        accumulatedData.streamId = chunk.id;
        event.sender.send('chat-stream-start', {
            id: accumulatedData.streamId,
            role: delta?.role || "assistant"
        });
        accumulatedData.isFirstChunk = false;
    }

    if (delta?.content) {
        accumulatedData.content += delta.content;
        event.sender.send('chat-stream-content', { content: delta.content });
    }

    // Compound-beta reasoning streaming
    if (delta?.reasoning) {
        accumulatedData.reasoning += delta.reasoning;
        event.sender.send('chat-stream-reasoning', {
            reasoning: delta.reasoning,
            accumulated: accumulatedData.reasoning
        });
    }

    // Compound-beta executed tools streaming - handles progressive tool execution
    if (delta?.executed_tools?.length > 0) {
        for (const executedTool of delta.executed_tools) {
            let existingTool = accumulatedData.executedTools.find(t => t.index === executedTool.index);

            if (!existingTool) {
                // First delta: tool starts executing
                accumulatedData.executedTools.push({
                    index: executedTool.index,
                    type: executedTool.type,
                    arguments: executedTool.arguments || "",
                    output: executedTool.output || null,
                    name: executedTool.name || "",
                    search_results: executedTool.search_results || null
                });

                event.sender.send('chat-stream-tool-execution', {
                    type: 'start',
                    tool: {
                        index: executedTool.index,
                        type: executedTool.type,
                        arguments: executedTool.arguments,
                        name: executedTool.name
                    }
                });
            } else {
                // Second delta: tool execution completes with output
                if (executedTool.output !== undefined) {
                    existingTool.output = executedTool.output;
                    event.sender.send('chat-stream-tool-execution', {
                        type: 'complete',
                        tool: existingTool
                    });
                }
                if (executedTool.arguments) existingTool.arguments = executedTool.arguments;
                if (executedTool.name) existingTool.name = executedTool.name;
                if (executedTool.search_results) existingTool.search_results = executedTool.search_results;
            }
        }
    }

    // Regular MCP tool calls - accumulate incrementally streamed tool calls
    if (delta?.tool_calls?.length > 0) {
        for (const toolCallDelta of delta.tool_calls) {
            let existingCall = accumulatedData.toolCalls.find(tc => tc.index === toolCallDelta.index);

            if (!existingCall) {
                accumulatedData.toolCalls.push({
                    index: toolCallDelta.index,
                    id: toolCallDelta.id || `tool_${Date.now()}_${toolCallDelta.index}`,
                    type: toolCallDelta.type || 'function',
                    function: {
                        name: toolCallDelta.function?.name || "",
                        arguments: toolCallDelta.function?.arguments || ""
                    }
                });
            } else {
                if (toolCallDelta.function?.arguments) {
                    existingCall.function.arguments += toolCallDelta.function.arguments;
                }
                if (toolCallDelta.function?.name) {
                    existingCall.function.name = toolCallDelta.function.name;
                }
                if (toolCallDelta.id) {
                    existingCall.id = toolCallDelta.id;
                }
            }
        }
        event.sender.send('chat-stream-tool-calls', { tool_calls: accumulatedData.toolCalls });
    }

    return chunk.choices[0].finish_reason;
}

function handleStreamCompletion(event, accumulatedData, finishReason) {
    event.sender.send('chat-stream-complete', {
        content: accumulatedData.content,
        role: "assistant",
        tool_calls: accumulatedData.toolCalls.length > 0 ? accumulatedData.toolCalls : undefined,
        reasoning: accumulatedData.reasoning || undefined,
        executed_tools: accumulatedData.executedTools.length > 0 ? accumulatedData.executedTools : undefined,
        finish_reason: finishReason
    });
}

// Executes stream with retry logic for tool_use_failed errors
async function executeStreamWithRetry(groq, chatCompletionParams, event) {
    const MAX_TOOL_USE_RETRIES = 3;
    let retryCount = 0;

    while (retryCount <= MAX_TOOL_USE_RETRIES) {
        try {
            const accumulatedData = {
                content: "",
                toolCalls: [],
                reasoning: "",
                executedTools: [],
                isFirstChunk: true,
                streamId: null
            };

            const stream = await groq.chat.completions.create(chatCompletionParams);

            for await (const chunk of stream) {
                const finishReason = processStreamChunk(chunk, event, accumulatedData);

                if (finishReason) {
                    handleStreamCompletion(event, accumulatedData, finishReason);
                    return;
                }
            }

            event.sender.send('chat-stream-error', { error: "Stream ended unexpectedly." });
            return;

        } catch (error) {
            const isToolUseFailedError = error?.error?.code === 'tool_use_failed' || error?.message?.includes('tool_use_failed');

            if (isToolUseFailedError && retryCount < MAX_TOOL_USE_RETRIES) {
                retryCount++;
                continue;
            }

            const errorMessage = error instanceof Error ? error.message : String(error);
            event.sender.send('chat-stream-error', {
                error: `Failed to get chat completion: ${errorMessage}`,
                details: error
            });
            return;
        }
    }

    event.sender.send('chat-stream-error', { 
        error: `The model repeatedly failed to use tools correctly after ${MAX_TOOL_USE_RETRIES + 1} attempts. Please try rephrasing your request.` 
    });
}

/**
 * Handles streaming chat completions with support for compound-beta model features.
 * Supports progressive reasoning display, executed tools streaming, and MCP tool calls.
 * 
 * @param {Electron.IpcMainEvent} event - The IPC event object
 * @param {Array<object>} messages - Chat history messages
 * @param {string} model - Model name (optional, falls back to settings)
 * @param {object} settings - App settings including API key and model config
 * @param {object} modelContextSizes - Model capability metadata
 * @param {Array<object>} discoveredTools - Available MCP tools
 */
async function handleChatStream(event, messages, model, settings, modelContextSizes, discoveredTools) {
    try {
        validateApiKey(settings);
        const { modelToUse, modelInfo } = determineModel(model, settings, modelContextSizes);
        checkVisionSupport(messages, modelInfo, modelToUse);
        
        const groq = new Groq({ apiKey: settings.GROQ_API_KEY });
        const tools = prepareTools(discoveredTools);
        const cleanedMessages = cleanMessages(messages);
        const prunedMessages = pruneMessageHistory(cleanedMessages, modelToUse, modelContextSizes);
        const chatCompletionParams = buildApiParams(prunedMessages, modelToUse, settings, tools);
        
        await executeStreamWithRetry(groq, chatCompletionParams, event);
    } catch (outerError) {
        event.sender.send('chat-stream-error', { error: outerError.message || `Setup error: ${outerError}` });
    }
}

module.exports = { handleChatStream };
