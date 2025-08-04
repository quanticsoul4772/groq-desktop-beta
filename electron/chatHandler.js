const Groq = require('groq-sdk');
const { pruneMessageHistory } = require('./messageUtils'); // Import pruning logic

/**
 * Validates the API key from settings
 */
function validateApiKey(settings) {
    if (!settings.GROQ_API_KEY || settings.GROQ_API_KEY === "<replace me>") {
        throw new Error("API key not configured. Please add your GROQ API key in settings.");
    }
}

/**
 * Determines which model to use based on priority
 */
function determineModel(model, settings, modelContextSizes) {
    const modelToUse = model || settings.model || "llama-3.3-70b-versatile";
    const modelInfo = modelContextSizes[modelToUse] || modelContextSizes['default'] || { context: 8192, vision_supported: false };
    console.log(`Using model: ${modelToUse} (Context: ${modelInfo.context}, Vision: ${modelInfo.vision_supported})`);
    return { modelToUse, modelInfo };
}

/**
 * Checks if messages contain images and validates vision support
 */
function checkVisionSupport(messages, modelInfo, modelToUse) {
    const hasImages = messages.some(msg =>
        msg.role === 'user' &&
        Array.isArray(msg.content) &&
        msg.content.some(part => part.type === 'image_url')
    );

    if (hasImages && !modelInfo.vision_supported) {
        console.error(`ERROR: Attempting to use images with non-vision model: ${modelToUse}`);
        throw new Error(`The selected model (${modelToUse}) does not support image inputs. Please select a vision-capable model.`);
    }
}

/**
 * Prepares tools for the API call
 */
function prepareTools(discoveredTools) {
    const tools = (discoveredTools || []).map(tool => ({
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema || {}
        }
    }));
    console.log(`Prepared ${tools.length} tools for the API call.`);
    return tools;
}

/**
 * Cleans messages by removing internal fields and ensuring correct format
 */
function cleanMessages(messages) {
    return messages.map((msg, index) => {
        // Create a clean copy, then delete unwanted properties
        const cleanMsg = { ...msg };
        delete cleanMsg.reasoning;
        delete cleanMsg.isStreaming;
        delete cleanMsg.executed_tools; // Remove compound-beta field
        delete cleanMsg.liveReasoning; // Remove live streaming field
        delete cleanMsg.liveExecutedTools; // Remove live streaming field

        // Debug log to check what's being cleaned
        if (cleanMsg.executed_tools || cleanMsg.liveReasoning || cleanMsg.liveExecutedTools) {
            console.warn(`Message ${index} still has compound-beta fields after cleaning:`, {
                executed_tools: !!cleanMsg.executed_tools,
                liveReasoning: !!cleanMsg.liveReasoning,
                liveExecutedTools: !!cleanMsg.liveExecutedTools
            });
        }

        let finalMsg = { ...cleanMsg };

        // Ensure user message content is an array of parts
        if (finalMsg.role === 'user') {
            if (typeof finalMsg.content === 'string') {
                finalMsg.content = [{ type: 'text', text: finalMsg.content }];
            } else if (!Array.isArray(finalMsg.content)) {
                // Handle unexpected format - log and default to empty text
                console.warn('Unexpected user message content format, defaulting:', finalMsg.content);
                finalMsg.content = [{ type: 'text', text: '' }];
            }
            // Ensure all parts have a type
            finalMsg.content = finalMsg.content.map(part => ({ type: part.type || 'text', ...part }));
        }

        // Ensure assistant message content is a string
        if (finalMsg.role === 'assistant' && typeof finalMsg.content !== 'string') {
            if (Array.isArray(finalMsg.content)) {
                // Extract text from parts if it's an array
                const textContent = finalMsg.content.filter(p => p.type === 'text').map(p => p.text).join('');
                finalMsg.content = textContent;
            } else {
                // Attempt to stringify other non-string formats, log warning
                console.warn('Unexpected assistant message content format, attempting stringify:', finalMsg.content);
                try {
                    finalMsg.content = JSON.stringify(finalMsg.content);
                } catch { finalMsg.content = '[Non-string content]'; }
            }
        }

        // Ensure tool message content is stringified if not already
        if (finalMsg.role === 'tool' && typeof finalMsg.content !== 'string') {
            try {
                finalMsg.content = JSON.stringify(finalMsg.content);
            } catch (e) {
                console.warn("Could not stringify tool content:", finalMsg.content, "Error:", e);
                finalMsg.content = "[Error stringifying tool content]";
            }
        }
        return finalMsg;
    });
}

/**
 * Builds the chat completion parameters for the API
 */
function buildApiParams(prunedMessages, modelToUse, settings, tools) {
    // Construct the system prompt
    let systemPrompt = "You are a helpful assistant capable of using tools. Use tools only when necessary and relevant to the user's request. Format responses using Markdown.";
    if (settings.customSystemPrompt && settings.customSystemPrompt.trim()) {
        systemPrompt += `\n\n${settings.customSystemPrompt.trim()}`;
        console.log("Appending custom system prompt.");
    }

    // Prepare API parameters
    const chatCompletionParams = {
        messages: [
            { role: "system", content: systemPrompt },
            ...prunedMessages
        ],
        model: modelToUse,
        temperature: settings.temperature ?? 0.7,
        top_p: settings.top_p ?? 0.95,
        ...(tools.length > 0 && { tools: tools, tool_choice: "auto" }),
        stream: true
    };

    return chatCompletionParams;
}

/**
 * Processes a single chunk from the stream
 */
function processStreamChunk(chunk, event, accumulatedData) {
    if (!chunk.choices || !chunk.choices.length || !chunk.choices[0]) return;

    const choice = chunk.choices[0];
    const delta = choice.delta;

    // Handle first chunk
    if (accumulatedData.isFirstChunk) {
        accumulatedData.streamId = chunk.id;
        event.sender.send('chat-stream-start', {
            id: accumulatedData.streamId,
            role: delta?.role || "assistant"
        });
        accumulatedData.isFirstChunk = false;
    }

    // Accumulate content
    if (delta?.content) {
        accumulatedData.content += delta.content;
        event.sender.send('chat-stream-content', { content: delta.content });
    }

    // Handle compound-beta model reasoning streaming
    if (delta?.reasoning) {
        accumulatedData.reasoning += delta.reasoning;
        event.sender.send('chat-stream-reasoning', {
            reasoning: delta.reasoning,
            accumulated: accumulatedData.reasoning
        });
    }

    // Handle compound-beta model executed tools
    if (delta?.executed_tools && delta.executed_tools.length > 0) {
        for (const executedTool of delta.executed_tools) {
            let existingTool = accumulatedData.executedTools.find(t => t.index === executedTool.index);

            if (!existingTool) {
                // New tool execution
                accumulatedData.executedTools.push({
                    index: executedTool.index,
                    type: executedTool.type,
                    arguments: executedTool.arguments || "",
                    output: executedTool.output || null,
                    name: executedTool.name || "",
                    search_results: executedTool.search_results || null
                });

                // Send tool execution start event
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
                // Update existing tool with new information (like output)
                if (executedTool.output !== undefined) {
                    existingTool.output = executedTool.output;

                    // Send tool execution complete event
                    event.sender.send('chat-stream-tool-execution', {
                        type: 'complete',
                        tool: existingTool
                    });
                }

                // Update other fields if provided
                if (executedTool.arguments) existingTool.arguments = executedTool.arguments;
                if (executedTool.name) existingTool.name = executedTool.name;
                if (executedTool.search_results) existingTool.search_results = executedTool.search_results;
            }
        }
    }

    // Accumulate and process tool calls
    if (delta?.tool_calls && delta.tool_calls.length > 0) {
        for (const toolCallDelta of delta.tool_calls) {
            let existingCall = accumulatedData.toolCalls.find(tc => tc.index === toolCallDelta.index);

            if (!existingCall) {
                // Start of a new tool call
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
                // Append to existing tool call arguments
                if (toolCallDelta.function?.arguments) {
                    existingCall.function.arguments += toolCallDelta.function.arguments;
                }
                // Update name if provided incrementally (less common)
                if (toolCallDelta.function?.name) {
                    existingCall.function.name = toolCallDelta.function.name;
                }
                // Update id if provided later
                if (toolCallDelta.id) {
                    existingCall.id = toolCallDelta.id;
                }
            }
        }
        // Send update with potentially partial tool calls
        event.sender.send('chat-stream-tool-calls', { tool_calls: accumulatedData.toolCalls });
    }

    return choice.finish_reason;
}

/**
 * Handles stream completion
 */
function handleStreamCompletion(event, accumulatedData, finishReason) {
    console.log(`Stream completed. Reason: ${finishReason}, ID: ${accumulatedData.streamId}`);
    event.sender.send('chat-stream-complete', {
        content: accumulatedData.content,
        role: "assistant",
        tool_calls: accumulatedData.toolCalls.length > 0 ? accumulatedData.toolCalls : undefined,
        reasoning: accumulatedData.reasoning || undefined,
        executed_tools: accumulatedData.executedTools.length > 0 ? accumulatedData.executedTools : undefined,
        finish_reason: finishReason
    });
}

/**
 * Executes the stream with retry logic
 */
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

            console.log(`Attempting Groq completion (attempt ${retryCount + 1}/${MAX_TOOL_USE_RETRIES + 1})...`);
            const stream = await groq.chat.completions.create(chatCompletionParams);

            for await (const chunk of stream) {
                const finishReason = processStreamChunk(chunk, event, accumulatedData);

                if (finishReason) {
                    handleStreamCompletion(event, accumulatedData, finishReason);
                    return; // Exit function successfully after completion
                }
            }

            // If loop finishes without finish_reason (should not happen with Groq stream)
            console.warn("Stream ended unexpectedly without a finish_reason.");
            event.sender.send('chat-stream-error', { error: "Stream ended unexpectedly." });
            return;

        } catch (error) {
            // Check for tool_use_failed specifically
            const isToolUseFailedError =
                error?.error?.code === 'tool_use_failed' ||
                (error?.message && error.message.includes('tool_use_failed'));

            if (isToolUseFailedError && retryCount < MAX_TOOL_USE_RETRIES) {
                retryCount++;
                console.warn(`Tool use failed error encountered. Retrying (${retryCount}/${MAX_TOOL_USE_RETRIES})...`);
                continue; // Go to the next iteration of the while loop
            }

            // Handle other errors or exhausted retries
            console.error('Error during Groq stream processing:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            event.sender.send('chat-stream-error', {
                error: `Failed to get chat completion: ${errorMessage}`,
                details: error
            });
            return; // Exit function after sending error
        }
    }

    // If retries are exhausted for tool_use_failed
    if (retryCount > MAX_TOOL_USE_RETRIES) {
        console.error(`Max retries (${MAX_TOOL_USE_RETRIES}) exceeded for tool_use_failed error.`);
        event.sender.send('chat-stream-error', { error: `The model repeatedly failed to use tools correctly after ${MAX_TOOL_USE_RETRIES + 1} attempts. Please try rephrasing your request.` });
    }
}

/**
 * Handles the 'chat-stream' IPC event for streaming chat completions.
 *
 * @param {Electron.IpcMainEvent} event - The IPC event object.
 * @param {Array<object>} messages - The array of message objects for the chat history.
 * @param {string} model - The specific model requested for this completion.
 * @param {object} settings - The current application settings.
 * @param {object} modelContextSizes - Object containing context window sizes for models.
 * @param {Array<object>} discoveredTools - List of available MCP tools.
 */
async function handleChatStream(event, messages, model, settings, modelContextSizes, discoveredTools) {
    console.log(`Handling chat-stream request. Model: ${model || 'using settings'}, Messages: ${messages?.length}`);

    try {
        // Step 1: Validate API key
        validateApiKey(settings);

        // Step 2: Determine model and get model info
        const { modelToUse, modelInfo } = determineModel(model, settings, modelContextSizes);

        // Step 3: Check vision support
        checkVisionSupport(messages, modelInfo, modelToUse);

        // Step 4: Initialize Groq SDK
        const groq = new Groq({ apiKey: settings.GROQ_API_KEY });

        // Step 5: Prepare tools
        const tools = prepareTools(discoveredTools);

        // Step 6: Clean and prepare messages
        const cleanedMessages = cleanMessages(messages);

        // Step 7: Prune message history
        const prunedMessages = pruneMessageHistory(cleanedMessages, modelToUse, modelContextSizes);
        console.log(`History pruned: ${cleanedMessages.length} -> ${prunedMessages.length} messages.`);

        // Final debug check before API call
        prunedMessages.forEach((msg, index) => {
            if (msg.executed_tools || msg.liveReasoning || msg.liveExecutedTools || msg.reasoning) {
                console.error(`FINAL CHECK: Message ${index} still has forbidden fields:`, {
                    role: msg.role,
                    executed_tools: !!msg.executed_tools,
                    liveReasoning: !!msg.liveReasoning,
                    liveExecutedTools: !!msg.liveExecutedTools,
                    reasoning: !!msg.reasoning
                });
            }
        });

        // Step 8: Build API parameters
        const chatCompletionParams = buildApiParams(prunedMessages, modelToUse, settings, tools);

        // Step 9: Execute stream with retry logic
        await executeStreamWithRetry(groq, chatCompletionParams, event);

    } catch (outerError) {
        // Catch errors during setup (e.g., validation, SDK init, message prep)
        console.error('Error setting up chat completion stream:', outerError);
        event.sender.send('chat-stream-error', { error: outerError.message || `Setup error: ${outerError}` });
    }
}

module.exports = {
    handleChatStream
}; 