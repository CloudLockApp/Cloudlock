// Interactive Background - Matrix-style Code Rain Effect

function createInteractiveBackground() {
    const bgAnimation = document.querySelector('.bg-animation');
    
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
    function createCodeLine() {
        const codeLine = document.createElement('div');
        codeLine.className = 'code-line';
        codeLine.textContent = codeSnippets[Math.floor(Math.random() * codeSnippets.length)];
        
        // Random horizontal position
        codeLine.style.left = Math.random() * 100 + '%';
        
        // Random animation duration (slower = more dramatic)
        const duration = 15 + Math.random() * 10; // 15-25 seconds
        codeLine.style.animationDuration = duration + 's';
        
        // Random delay
        codeLine.style.animationDelay = Math.random() * 5 + 's';
        
        // Random opacity variation
        codeLine.style.opacity = 0.2 + Math.random() * 0.3;
        
        bgAnimation.appendChild(codeLine);
        
        // Remove after animation completes
        setTimeout(() => {
            codeLine.remove();
        }, (duration + 5) * 1000);
    }

    // Create initial code lines
    for (let i = 0; i < 20; i++) {
        setTimeout(() => createCodeLine(), i * 500);
    }

    // Continuously add new code lines
    setInterval(() => {
        createCodeLine();
    }, 3000);

    // Mouse trail effect - creates glowing particles on mouse move
    let mouseTimeout;
    document.addEventListener('mousemove', (e) => {
        clearTimeout(mouseTimeout);
        mouseTimeout = setTimeout(() => {
            createMouseParticle(e.clientX, e.clientY);
        }, 100);
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

// Initialize background when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createInteractiveBackground);
} else {
    createInteractiveBackground();
}