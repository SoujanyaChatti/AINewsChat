const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
const NodeCache = require('node-cache'); // Already installed

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Cache for 1 hour to reduce API requests
const cache = new NodeCache({ stdTTL: 3600 });

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

// News report generation with Mistral and World News API
app.get('/news_report', async (req, res) => {
    const topic = req.query.topic;
    const debate = req.query.debate === 'true';
    const area = req.query.area; // Optional

    if (!topic) {
        return res.json({ error: "Please enter a topic." });
    }

    const cacheKey = `${topic}-${debate}-${area || ''}`;
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
        console.log(`Returning cached response for ${topic}`);
        return res.json(cachedResponse);
    }

    try {
        const processedTopic = cleanQuery(topic);
        const worldNewsUrl = `https://api.worldnewsapi.com/search-news?text=${encodeURIComponent(processedTopic)}&api-key=${process.env.WORLD_NEWS_API_KEY}&language=en`;
        console.log(`Fetching news from: ${worldNewsUrl}`);
        const worldNewsResponse = await axios.get(worldNewsUrl, { timeout: 10000 });

        if (worldNewsResponse.status !== 200) {
            console.log(`World News API error - Status: ${worldNewsResponse.status}, Data: ${JSON.stringify(worldNewsResponse.data)}`);
            return res.json({ error: "Failed to fetch news" });
        }

        const articles = worldNewsResponse.data.news.slice(0, 5);
        if (!articles.length) {
            return res.json({ error: "No relevant articles found" });
        }

        if (area) {
            const filteredArticles = articles.filter(a => 
                a.title.toLowerCase().includes(area.toLowerCase()) || 
                a.text.toLowerCase().includes(area.toLowerCase())
            );
            if (!filteredArticles.length) {
                return res.json({ error: `No news found for ${processedTopic} in ${area}` });
            }
            articles = filteredArticles;
        }

        const newsContent = articles.map(a => `Title: ${a.title}\nSummary: ${a.text.substring(0, 200)}`).join("\n\n");

        let prompt = `You are an AI news reporter. Create a concise news report (max 450 words, ~3 minutes at 150 wpm) based on:\n\n${newsContent}\n\nKeep it engaging and structured.`;
        if (debate) {
            prompt += "\n\n**Format:**\n1. A debate between Alice and Bob (max 300 words total):\n   - **Alice** argues FOR the topic (1-2 sentences per turn).\n   - **Bob** argues AGAINST the topic (1-2 sentences per turn).\n   - At least 3 rounds of exchange.\n   - Use 'Alice: ' and 'Bob: ' prefixes.\n2. A neutral summary (max 150 words).";
        }

        console.log(`Sending prompt to Mistral: ${prompt.substring(0, 100)}...`);
        const mistralUrl = "https://api.mistral.ai/v1/chat/completions"; // Verify with Mistral docs
        const mistralResponse = await axios.post(mistralUrl, {
            model: "mistral-tiny",
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

        let audioUrl;
        try {
            const ttsEndpoint = debate ? "https://fal.run/fal-ai/playai/tts/dialog" : "https://fal.run/fal-ai/playai/tts/v3";
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

            console.log(`Sending TTS request to ${ttsEndpoint} with payload: ${JSON.stringify(ttsPayload)}`);
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

        const response = { report: newsReport, audio_url: audioUrl || "https://example.com/fallback-audio.mp3" };
        cache.set(cacheKey, response); // Cache successful response
        res.json(response);
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
