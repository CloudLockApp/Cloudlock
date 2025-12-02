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
        const response = await fetch("/.netlify/functions/openrouter-proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system: "You are a cybersecurity expert that is giving tips to someone creating passwords and concerned about online security. Eighty words maximum.",
                user: message,
                model: "alibaba/tongyi-deepresearch-30b-a3b:free"
            })
        });

       
        // Remove typing indicator
        const typingMsg = messagesContainer.querySelector('.typing');
        if (typingMsg) typingMsg.remove();
       
        if (response.ok) {
            const data = await response.json();
            const aiResponse =
                data?.choices?.[0]?.message?.content ||
                "No response received.";

            const formattedResponse = marked.parse(aiResponse);
            messagesContainer.innerHTML += `
                <div class="ai-message bot">${formattedResponse}</div>
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


// Openrouter Insight Summarizer
async function generateAIInsight(aiSummary) {
    try {
        const response = await fetch("/.netlify/functions/openrouter-proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system: "You are a cybersecurity expert. Analyze how strong or weak the password is based only on its metadata. Eighty words maximum.",
                user: "Analyze this password's metadata and give security insight: " + aiSummary,
                model: "alibaba/tongyi-deepresearch-30b-a3b:free"
            })
        });

        const data = await response.json();
        return data?.choices?.[0]?.message?.content || "We have no insights right now.";
    } catch (error) {
        console.error("OpenRouter Insight Error Detected:", error);
        return "⚠️ We cannot generate the OpenRouter AI Insight at the moment.";
    }
}



async function unsecureDetector(passwordId) {
    const password = passwords.find(p => p.id === passwordId);
    if (!password) return;

    const aiElement = document.getElementById(`ai-insight-${passwordId}`);
    
    // Check if already loaded
    if (aiElement.dataset.loaded === 'true') {
        return;
    }

    // Show loading state
    aiElement.innerHTML = '<div style="padding: 10px;">Loading insight...</div>';

    let sequentialCount = 0;
    let commonCount = 0;

    // count sequential char runs
    function countSequentialRuns(str) {
        const lower = str.toLowerCase();
        const sources = [
            "abcdefghijklmnopqrstuvwxyz",
            "0123456789",
            "qwertyuiopasdfghjklzxcvbnm"
        ];
        let count = 0;

        function seqCount(source) {
            const reversed = source.split("").reverse().join("");
            const both = [source, reversed];
    
            for (const seq of both) {
                for (let i = 0; i < lower.length - 2; i++) {
                    const slice = lower.substr(i, 3);
                    if (seq.includes(slice)) count++;
                }
            }
        }
    
        sources.forEach(seqCount);
        sequentialCount = count;
        return sequentialCount;
    }

    // count common words
    function countCommonWords(str) {
        const commonPasswords = ["password", "qwerty123", "secret", "iloveyou", "dragon", "monkey", "1q2w3e4r", "admin", "lovely", "welcome", "princess", "hello", "hi", "google", "computer", "login", "football", "starwars", "baseball", "superman"];
        const lower = str.toLowerCase();
        let count = 0;
    
        for (const word of commonPasswords) {
            if (lower.includes(word)) count++;
        }
        commonCount = count;
        return commonCount;
    }

    function countRepeatedCharacters(str) {
      const freq = {};
      for (const ch of str) {
        freq[ch] = (freq[ch] || 0) + 1;
      }

      let repeatedTotal = 0;
      for (const ch in freq) {
        if (freq[ch] > 1) {
          repeatedTotal += freq[ch];
        }
      }
      return repeatedTotal;
    }



    const decrypted = decrypt(password.password);
    const length = decrypted.length;
    const upperCount = /[A-Z]/.test(decrypted);
    const lowerCount = /[a-z]/.test(decrypted);
    const numCount = /[0-9]/.test(decrypted);
    const symbolCount = /[^A-Za-z0-9]/.test(decrypted);
    sequentialCount = countSequentialRuns(decrypted);
    commonCount = countCommonWords(decrypted);
    const repeatedCount = countRepeatedCharacters(decrypted);

    // Count password reuse
    const decryptedPasswords = passwords.map(p => decrypt(p.password));
    const passwordCounts = {};
    decryptedPasswords.forEach(p => passwordCounts[p] = (passwordCounts[p] || 0) + 1);
    const reusedCount = passwordCounts[decrypted];

    const lastUpdated = password.updatedAt ? new Date(password.updatedAt.seconds * 1000) : null;
    const daysOld = lastUpdated ? Math.floor((Date.now() - lastUpdated) / (1000 * 60 * 60 * 24)) : "unknown";

    const summary = `
        For site ${password.siteName}, the password has length ${length}.
        It ${upperCount ? "includes" : "does not include"} uppercase letters,
        ${lowerCount ? "includes" : "does not include"} lowercase letters,
        ${numCount ? "includes" : "does not include"} numbers,
        and ${symbolCount ? "includes" : "does not include"} symbols.
        It is used on ${reusedCount} accounts and was last updated ${daysOld} days ago.
        It has ${sequentialCount} sequential characters. Count should be zero.
        It has ${commonCount} common words/passwords. Count should be zero.
        It has ${repeatedCount} repeated characters. Count should be low.
        Provide a small paragraph that analyzes the security situation. Provide tips. Ten sentences max.
    `;

    const insight = await generateAIInsight(summary);

    aiElement.innerHTML = `
        <div class="alert" style="background: rgba(255,255,255,0.05); border-left: 3px solid #0af; padding: 8px; border-radius: 6px;">
            <strong>🔍 AI Insight:</strong> ${marked.parse(insight)}
        </div>
    `;
    
    // Mark as loaded so we don't fetch again
    aiElement.dataset.loaded = 'true';
}