const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '.'))); // Serve static files (index.html, styles)

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

function cleanQuery(text) {
    const words = text.toLowerCase().split(' ');
    const stopwords = ["give", "me", "news", "about", "the", "case", "latest", "report", "vs", "is", "explain"];
    const keywords = words.filter(word => !stopwords.includes(word));
    return keywords.join(' ');
}

function limitWords(text, maxWords = 450) {
    const words = text.split(' ');
    if (words.length > maxWords) {
        return words.slice(0, maxWords).join(' ') + " [Truncated to 3 minutes]";
    }
    return text;
}

// News report generation with Mistral (via API call)
app.get('/news_report', async (req, res) => {
    const topic = req.query.topic;
    const debate = req.query.debate === 'true';
    const area = req.query.area; // Optional

    if (!topic) {
        return res.json({ error: "Please enter a topic." });
    }

    try {
        const processedTopic = cleanQuery(topic);
        const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(processedTopic)}&language=en&apiKey=${process.env.NEWS_API_KEY}`;
        console.log(`Fetching news from: ${newsUrl}`);
        const newsResponse = await axios.get(newsUrl, { timeout: 10000 });

        if (newsResponse.status !== 200) {
            console.log(`NewsAPI error - Status: ${newsResponse.status}, Data: ${JSON.stringify(newsResponse.data)}`);
            return res.json({ error: "Failed to fetch news" });
        }

        const articles = newsResponse.data.articles.slice(0, 5);
        if (!articles.length) {
            return res.json({ error: "No relevant articles found" });
        }

        if (area) {
            const filteredArticles = articles.filter(a => 
                a.title.toLowerCase().includes(area.toLowerCase()) || 
                (a.description && a.description.toLowerCase().includes(area.toLowerCase()))
            );
            if (!filteredArticles.length) {
                return res.json({ error: `No news found for ${processedTopic} in ${area}` });
            }
            articles = filteredArticles;
        }

        const newsContent = articles.map(a => `Title: ${a.title}\nSummary: ${a.description}`).join("\n\n");

        let prompt = `You are an AI news reporter. Create a concise news report (max 450 words, ~3 minutes at 150 wpm) based on:\n\n${newsContent}\n\nKeep it engaging and structured.`;
        if (debate) {
            prompt += "\n\n**Format:**\n1. A debate between Alice and Bob (max 300 words total):\n   - **Alice** argues FOR the topic (1-2 sentences per turn).\n   - **Bob** argues AGAINST the topic (1-2 sentences per turn).\n   - At least 3 rounds of exchange.\n   - Use 'Alice: ' and 'Bob: ' prefixes.\n2. A neutral summary (max 150 words).";
        }

        // Call Mistral API (no official JS library, use axios)
        const mistralUrl = "https://api.mistral.ai/v1/chat/completions"; // Check Mistral docs for exact endpoint
        const mistralResponse = await axios.post(mistralUrl, {
            model: "mistral-tiny", // Match your FastAPI model
            messages: [{ role: "user", content: prompt }],
        }, {
            headers: {
                "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (mistralResponse.status !== 200) {
            console.log(`Mistral error - Status: ${mistralResponse.status}, Data: ${JSON.stringify(mistralResponse.data)}`);
            return res.json({ error: "Failed to generate report" });
        }

        const newsReport = limitWords(mistralResponse.data.choices[0].message.content);
        console.log(`Generated report (${newsReport.split(' ').length} words):\n${newsReport}`);

        // Generate TTS using fal (via axios, replacing FAL_TTS_V3_ENDPOINT/FAL_TTS_DIALOG_ENDPOINT)
        let audioUrl;
        try {
            const ttsEndpoint = debate ? FAL_TTS_DIALOG_ENDPOINT : FAL_TTS_V3_ENDPOINT;
            const ttsPayload = {
                input: newsReport,
                response_format: "url"
            };
            if (debate) {
                ttsPayload.voices = [
                    { voice: "Jennifer (English (US)/American)", turn_prefix: "Alice: " },
                    { voice: "Furio (English (IT)/Italian)", turn_prefix: "Bob: " }
                ];
            } else {
                ttsPayload.voice = "Jennifer (English (US)/American)";
            }

            const ttsResponse = await axios.post(ttsEndpoint, ttsPayload, {
                headers: {
                    "Authorization": `Key ${process.env.FAL_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 120000 // 120s timeout for fal
            });

            if (ttsResponse.status !== 200) {
                console.log(`fal TTS error - Status: ${ttsResponse.status}, Data: ${JSON.stringify(ttsResponse.data)}`);
                audioUrl = null;
            } else {
                audioUrl = ttsResponse.data.audio.url;
            }
        } catch (ttsError) {
            console.error(`TTS error: ${ttsError.message}`);
            audioUrl = null;
        }

        res.json({ report: newsReport, audio_url: audioUrl || "https://example.com/audio.mp3" }); // Fallback if TTS fails
    } catch (error) {
        console.error(`Error in news_report: ${error.message}`);
        if (error.response) {
            console.error(`Response: ${error.response.status}, ${error.response.data}`);
        }
        res.json({ error: "Error fetching news: " + (error.message || "Network error") });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Note: FAL_TTS_DIALOG_ENDPOINT and FAL_TTS_V3_ENDPOINT are defined as constants at the top
const FAL_TTS_DIALOG_ENDPOINT = "https://fal.run/fal-ai/playai/tts/dialog";
const FAL_TTS_V3_ENDPOINT = "https://fal.run/fal-ai/playai/tts/v3";