// Interactive Background - Matrix-style Code Rain Effect - INSTANT LOAD VERSION

function createInteractiveBackground() {
    const bgAnimation = document.querySelector('.bg-animation') || 
                       document.getElementById('interactive-background-container') || 
                       document.body;
    
    // Add a check to prevent errors
    if (!bgAnimation) {
        console.warn('Background container not found');
        return;
    }
    
    // Code snippets for the matrix effect
    const codeSnippets = [
        'function encrypt(data) {',
        'const hash = SHA256(password);',
        'if (authenticated) {',
        'return await decrypt(cipher);',
        'const key = generateKey();',
        'localStorage.setItem("token", jwt);',
        'while (running) {',
        'console.log("Secured");',
        'import { verify } from "crypto";',
        'const token = JWT.sign(payload);',
        'try { validate() } catch(e) {}',
        'export default SecureVault;',
        'async function fetchData() {',
        'const response = await api.get();',
        'if (error) throw new Error();',
        'return encryptedData;',
        '// Zero-trust authentication',
        '// End-to-end encryption',
        'let isSecure = true;',
        'const users = await db.query();'
    ];

    // Create falling code lines
    function createCodeLine(initialDelay = 0) {
        const codeLine = document.createElement('div');
        codeLine.className = 'code-line';
        codeLine.textContent = codeSnippets[Math.floor(Math.random() * codeSnippets.length)];
        
        // Random horizontal position
        codeLine.style.left = Math.random() * 100 + '%';
        
        // Random animation duration (slower = more dramatic)
        const duration = 15 + Math.random() * 10; // 15-25 seconds
        codeLine.style.animationDuration = duration + 's';
        
        // Much shorter initial delay for instant appearance
        codeLine.style.animationDelay = initialDelay + 's';
        
        // Random opacity variation
        codeLine.style.opacity = 0.2 + Math.random() * 0.3;
        
        // Random starting position for instant visibility
        if (initialDelay === 0) {
            const randomStart = Math.random() * 100;
            codeLine.style.top = randomStart + '%';
        }
        
        bgAnimation.appendChild(codeLine);
        
        // Remove after animation completes
        setTimeout(() => {
            codeLine.remove();
        }, (duration + initialDelay) * 1000);
    }

    // Create initial code lines IMMEDIATELY with no delay
    // These will appear instantly at random positions
    for (let i = 0; i < 25; i++) {
        createCodeLine(0); // Zero delay for instant appearance
    }

    // Add a few more with very short staggered delays for smooth effect
    for (let i = 0; i < 10; i++) {
        setTimeout(() => createCodeLine(Math.random() * 0.5), i * 50);
    }

    // Continuously add new code lines
    setInterval(() => {
        createCodeLine(Math.random() * 2);
    }, 2500);

    // Mouse trail effect - creates glowing particles on mouse move
    let mouseTimeout;
    let lastParticleTime = 0;
    const particleDelay = 50; // Milliseconds between particles
    
    document.addEventListener('mousemove', (e) => {
        const now = Date.now();
        if (now - lastParticleTime > particleDelay) {
            createMouseParticle(e.clientX, e.clientY);
            lastParticleTime = now;
        }
    });

    function createMouseParticle(x, y) {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.width = '4px';
        particle.style.height = '4px';
        particle.style.borderRadius = '50%';
        particle.style.background = 'rgba(167, 139, 250, 0.6)';
        particle.style.boxShadow = '0 0 10px rgba(167, 139, 250, 0.8)';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '1';
        particle.style.animation = 'particleFade 1s ease-out forwards';
        
        document.body.appendChild(particle);
        
        setTimeout(() => particle.remove(), 1000);
    }

    // Add particle fade animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes particleFade {
            0% {
                opacity: 1;
                transform: scale(1);
            }
            100% {
                opacity: 0;
                transform: scale(0);
            }
        }
    `;
    document.head.appendChild(style);
}

// Initialize background IMMEDIATELY - don't wait for DOMContentLoaded if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createInteractiveBackground);
} else {
    // Execute immediately if DOM is already ready
    createInteractiveBackground();
}