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
        // Call OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.openai.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful AI security assistant for a password manager. Provide advice on password security, help generate strong passwords, and answer security-related questions.'
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                temperature: 0.7,
                max_tokens: 200
            })
        });
        
        // Remove typing indicator
        const typingMsg = messagesContainer.querySelector('.typing');
        if (typingMsg) typingMsg.remove();
        
        if (response.ok) {
            const data = await response.json();
            const aiResponse = data.choices[0].message.content;
            
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
            <div class="ai-message bot">I can help you with password security tips! Try asking me about generating strong passwords, security best practices, or password analysis.</div>
        `;
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}