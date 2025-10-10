// AI Assistant Module

// Toggle AI chat window
function toggleAIChat() {
    document.getElementById('ai-chat').classList.toggle('active');
}

// Handle AI chat input
function handleAIChat(event) {
    if (event.key === 'Enter') {
        sendAIMessage();
    }
}

// Send message to AI
async function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const message = input.value.trim();
    if (!message) return;
    
    const messagesContainer = document.getElementById('ai-messages');
    
    // Add user message
    messagesContainer.innerHTML += `
        <div class="ai-message user">${message}</div>
    `;
    
    input.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Show typing indicator
    messagesContainer.innerHTML += `
        <div class="ai-message bot typing">AI is thinking...</div>
    `;
    
    try {
        const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.gemini.apiKey}`,
                {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                                contents: [
                                        {
                                                role: 'user',
                                                parts: [
                                                        { text: `You are an AI model designed to detect threats to the password management system. User: ${message}` }
                                                ]
                                        }
                                ]
                        })
                }
        );


        
        // Remove typing indicator
        const typingMsg = messagesContainer.querySelector('.typing');
        if (typingMsg) typingMsg.remove();
        
        if (response.ok) {
            const data = await response.json();
            const aiResponse =
                data?.candidates?.[0]?.content?.parts?.[0]?.text ||
                "There are no responses received.";

            
            messagesContainer.innerHTML += `
                <div class="ai-message bot">${aiResponse}</div>
            `;
        } else {
            messagesContainer.innerHTML += `
                <div class="ai-message bot">I'm having trouble connecting to the AI service. Please try again later.</div>
            `;
        }
    } catch (error) {
        // Remove typing indicator
        const typingMsg = messagesContainer.querySelector('.typing');
        if (typingMsg) typingMsg.remove();
        
        messagesContainer.innerHTML += `
            <div class="ai-message bot">Connection error: ${error.message}</div>
        `;
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}