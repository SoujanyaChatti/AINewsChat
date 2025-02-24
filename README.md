# AI News Chat

## Overview
AI News Chat is an innovative web application for the ElevenLabs hackathon, designed to fetch real-time news, generate concise AI-powered reports, and provide interactive voice features. Users can input topics via text or speech, receive news reports or debates, and listen to audio responses, all with a modern, user-friendly interface.

## Features
- **Real-Time News Reports**: Fetch news on any topic (e.g., "elon musk") using a news API, summarized into engaging, 3-minute reports (450 words max).
- **Debate Mode**: Toggle to generate structured debates between two AI voices (Alice and Bob) with a neutral summary for topics like "kumbh mela 2025."
- **Voice Input**: Use browser speech recognition to input topics vocally.
- **Audio Playback**: Listen to reports via text-to-speech (TTS), with a draggable audio player for interactivity.

## Models
- **Mistral AI (mistral-tiny)**: Generates concise, structured news reports and debates based on news data, ensuring engaging and relevant content.
- **fal TTS Models**: Utilizes advanced text-to-speech models, such as Jennifer (English/US/American) and Furio (English/IT/Italian), for converting news reports and debates into natural, engaging audio via dialog/v3 endpoints, powered by 300k hackathon credits.

## APIs
- **World News API**: Fetches real-time news articles from over 50,000 global sources, replacing NewsAPI to avoid free-tier restrictions on production environments.
- - **Mistral API**: Leverages the mistral-tiny model endpoint to generate concise, structured news reports and debates based on news data, ensuring relevant and engaging content for users.
- **fal TTS API**: Converts reports and debates into audio using dialog/v3 endpoints, powered by 300k hackathon credits, for voices like Jennifer (English/US) and Furio (English/IT).

![Modern Pastel Flowchart](https://github.com/user-attachments/assets/13094605-8ba5-4119-a791-e9851922274d)
