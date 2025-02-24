const API_URL = "https://ainewschat.onrender.com"; // Update to your deployed URL later (e.g., Heroku)

function startVoiceInput() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.start();
    recognition.onresult = function(event) {
        document.getElementById("topic").value = event.results[0][0].transcript;
    };
}

function stopAllAudio() {
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute('autoplay');
    });
}

async function fetchNewsReport() {
    let topic = document.getElementById("topic").value;
    let debate = document.getElementById("debateMode").checked;
    let chatBox = document.getElementById("chatBox");

    if (!topic) {
        alert("Please enter a topic.");
        return;
    }

    stopAllAudio();

    let userMessage = document.createElement("div");
    userMessage.className = "user-message";
    userMessage.innerHTML = `<strong>You:</strong> ${topic} ${debate ? "[Debate Mode]" : ""}`;
    chatBox.appendChild(userMessage);

    let loadingMessage = document.createElement("div");
    loadingMessage.className = "loading-container";
    loadingMessage.id = `loading-${Date.now()}`;
    loadingMessage.innerHTML = `<strong>AI:</strong> Generating your news... <div class="spinner"><span></span><span></span><span></span></div>`;
    chatBox.appendChild(loadingMessage);
    chatBox.scrollTop = chatBox.scrollHeight;

    let query = `${API_URL}/news_report?topic=${encodeURIComponent(topic)}&debate=${debate}`;
    try {
        let res = await fetch(query);
        let data = await res.json();
        console.log("API Response:", data); // Debug

        loadingMessage.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => loadingMessage.remove(), 300);

        if (data.error) {
            let errorMessage = document.createElement("div");
            errorMessage.className = "bot-message";
            errorMessage.innerHTML = `<strong>AI:</strong> ${data.error}`;
            chatBox.appendChild(errorMessage);
        } else {
            let reportId = `report-${Date.now()}`;
            let audioSrc = data.audio_url;
            
            let botMessage = document.createElement("div");
            botMessage.className = "bot-message";
            botMessage.id = reportId;
            botMessage.innerHTML = `<strong>AI:</strong> ${formatReport(data.report, debate)}`;

            let audioPlayer = document.createElement("div");
            audioPlayer.className = `audio-player ${audioSrc ? '' : 'loading'}`;
            audioPlayer.id = `audio-${reportId}`;

            if (audioSrc) {
                let audio = document.createElement("audio");
                audio.controls = true;
                audio.autoplay = true;
                let source = document.createElement("source");
                source.src = audioSrc;
                source.type = "audio/mpeg";
                audio.appendChild(source);
                audioPlayer.appendChild(audio);
            } else {
                audioPlayer.textContent = "Audio unavailable";
            }

            botMessage.appendChild(audioPlayer);
            chatBox.appendChild(botMessage);
        }
    } catch (error) {
        console.error("Fetch error:", error);
        loadingMessage.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => loadingMessage.remove(), 300);
        let errorMessage = document.createElement("div");
        errorMessage.className = "bot-message";
        errorMessage.innerHTML = `<strong>AI:</strong> Error fetching news: ${error.message || 'Network error'}`;
        chatBox.appendChild(errorMessage);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}

function formatReport(report, debate) {
    if (!debate) return `<p>${report}</p>`;
    let lines = report.split("\n");
    let debateHTML = "";
    lines.forEach(line => {
        if (line.trim()) {
            let parts = line.trim().split(": ", 2);
            if (parts.length === 2) {
                debateHTML += `<div class="debate-text"><span class="debate-speaker">${parts[0]}:</span> ${parts[1]}</div>`;
            } else {
                debateHTML += `<div class="debate-text">${line}</div>`;
            }
        }
    });
    return debateHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('mousedown', (e) => {
        let player = e.target.closest('.audio-player');
        if (!player || player.classList.contains('loading')) return;

        let shiftX = e.clientX - player.getBoundingClientRect().left;
        let shiftY = e.clientY - player.getBoundingClientRect().top;

        function moveAt(pageX, pageY) {
            const chatContainer = document.querySelector('.chat-container');
            const containerRect = chatContainer.getBoundingClientRect();
            const maxX = containerRect.width - player.offsetWidth; // Full width constraint

            let newX = pageX - shiftX;
            if (newX < 0) newX = 0;
            if (newX > maxX) newX = maxX;

            player.style.left = newX + 'px';
            player.style.top = pageY - shiftY + 'px';
        }

        function onMouseMove(event) {
            moveAt(event.pageX, event.pageY);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', () => {
            document.removeEventListener('mousemove', onMouseMove);
        }, { once: true });
    });

    document.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'AUDIO') e.stopPropagation();
    }, true);
});
